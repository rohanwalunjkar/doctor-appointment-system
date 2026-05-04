from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models.models import (
    User, Appointment, DoctorProfile, TimeSlot,
    AppointmentStatus, Notification,
)
from app.schemas.schemas import (
    AppointmentCreate, AppointmentUpdate, AppointmentResponse,
    TimeSlotResponse, TimeSlotBlock,
)
from app.utils.auth import get_current_user, get_current_active_doctor

router = APIRouter(prefix="/api/appointments", tags=["Appointments"])


# ─── Time Slots ──────────────────────────────────────────────────────

@router.get("/slots/{doctor_id}", response_model=List[TimeSlotResponse])
def get_available_slots(
    doctor_id: int,
    date_from: date = Query(...),
    date_to: Optional[date] = None,
    db: Session = Depends(get_db),
):
    """Get available time slots for a doctor within a date range."""
    if not date_to:
        date_to = date_from

    slots = (
        db.query(TimeSlot)
        .filter(
            TimeSlot.doctor_id == doctor_id,
            TimeSlot.date >= date_from,
            TimeSlot.date <= date_to,
            TimeSlot.is_booked == False,
            TimeSlot.is_blocked == False,
        )
        .order_by(TimeSlot.date, TimeSlot.start_time)
        .all()
    )
    return slots


@router.post("/slots/block")
def block_slots(
    data: TimeSlotBlock,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_doctor),
):
    """Block specific time slots (Doctor only)."""
    profile = db.query(DoctorProfile).filter(DoctorProfile.user_id == current_user.id).first()
    blocked_count = 0
    for slot_id in data.slot_ids:
        slot = (
            db.query(TimeSlot)
            .filter(TimeSlot.id == slot_id, TimeSlot.doctor_id == profile.id, TimeSlot.is_booked == False)
            .first()
        )
        if slot:
            slot.is_blocked = True
            blocked_count += 1
    db.commit()
    return {"message": f"{blocked_count} slot(s) blocked successfully"}


# ─── Appointments ────────────────────────────────────────────────────

@router.post("/", response_model=AppointmentResponse, status_code=201)
def create_appointment(
    data: AppointmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Book an appointment with a doctor."""
    # Validate doctor
    doctor = db.query(DoctorProfile).filter(DoctorProfile.id == data.doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    if not doctor.is_available:
        raise HTTPException(status_code=400, detail="Doctor is not currently available")

    # Validate time slot
    slot = (
        db.query(TimeSlot)
        .filter(
            TimeSlot.id == data.time_slot_id,
            TimeSlot.doctor_id == data.doctor_id,
        )
        .first()
    )
    if not slot:
        raise HTTPException(status_code=404, detail="Time slot not found")
    if slot.is_booked:
        raise HTTPException(status_code=400, detail="This time slot is already booked")
    if slot.is_blocked:
        raise HTTPException(status_code=400, detail="This time slot is blocked by the doctor")

    # Create appointment
    appointment = Appointment(
        patient_id=current_user.id,
        doctor_id=data.doctor_id,
        time_slot_id=data.time_slot_id,
        appointment_date=slot.date,
        start_time=slot.start_time,
        end_time=slot.end_time,
        status=AppointmentStatus.PENDING,
        reason=data.reason,
    )
    slot.is_booked = True
    db.add(appointment)

    # Create notification for the doctor
    doctor_user = db.query(User).filter(User.id == doctor.user_id).first()
    notification = Notification(
        user_id=doctor_user.id,
        title="New Appointment Request",
        message=f"New appointment from {current_user.first_name} {current_user.last_name} on {slot.date} at {slot.start_time}",
        notification_type="appointment",
    )
    db.add(notification)
    db.commit()
    db.refresh(appointment)

    return (
        db.query(Appointment)
        .options(
            joinedload(Appointment.patient),
            joinedload(Appointment.doctor).joinedload(DoctorProfile.user),
            joinedload(Appointment.doctor).joinedload(DoctorProfile.specialization),
        )
        .filter(Appointment.id == appointment.id)
        .first()
    )


@router.get("/my", response_model=List[AppointmentResponse])
def get_my_appointments(
    status_filter: Optional[AppointmentStatus] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get appointments for the current user (patient or doctor)."""
    query = (
        db.query(Appointment)
        .options(
            joinedload(Appointment.patient),
            joinedload(Appointment.doctor).joinedload(DoctorProfile.user),
            joinedload(Appointment.doctor).joinedload(DoctorProfile.specialization),
        )
    )

    if current_user.role.value == "doctor":
        profile = db.query(DoctorProfile).filter(DoctorProfile.user_id == current_user.id).first()
        if profile:
            query = query.filter(Appointment.doctor_id == profile.id)
    else:
        query = query.filter(Appointment.patient_id == current_user.id)

    if status_filter:
        query = query.filter(Appointment.status == status_filter)

    appointments = (
        query.order_by(Appointment.appointment_date.desc(), Appointment.start_time.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    return appointments


@router.get("/{appointment_id}", response_model=AppointmentResponse)
def get_appointment(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get appointment details."""
    appointment = (
        db.query(Appointment)
        .options(
            joinedload(Appointment.patient),
            joinedload(Appointment.doctor).joinedload(DoctorProfile.user),
            joinedload(Appointment.doctor).joinedload(DoctorProfile.specialization),
        )
        .filter(Appointment.id == appointment_id)
        .first()
    )
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    # Check authorization
    profile = db.query(DoctorProfile).filter(DoctorProfile.user_id == current_user.id).first()
    doctor_id = profile.id if profile else None
    if appointment.patient_id != current_user.id and appointment.doctor_id != doctor_id and current_user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to view this appointment")

    return appointment


@router.patch("/{appointment_id}", response_model=AppointmentResponse)
def update_appointment(
    appointment_id: int,
    data: AppointmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update appointment status / add notes (Doctor or Admin)."""
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    update_dict = data.model_dump(exclude_unset=True)

    # Handle status changes
    if "status" in update_dict:
        new_status = update_dict["status"]

        # Patient can only cancel
        if current_user.role.value == "patient":
            if new_status != AppointmentStatus.CANCELLED:
                raise HTTPException(status_code=403, detail="Patients can only cancel appointments")
            if appointment.patient_id != current_user.id:
                raise HTTPException(status_code=403, detail="Not your appointment")

        # If cancelled, free up the time slot
        if new_status == AppointmentStatus.CANCELLED and appointment.time_slot_id:
            slot = db.query(TimeSlot).filter(TimeSlot.id == appointment.time_slot_id).first()
            if slot:
                slot.is_booked = False

        # If completed, increment doctor's patient count
        if new_status == AppointmentStatus.COMPLETED:
            doctor = db.query(DoctorProfile).filter(DoctorProfile.id == appointment.doctor_id).first()
            if doctor:
                doctor.total_patients += 1

    for key, value in update_dict.items():
        setattr(appointment, key, value)

    # Notification
    notification_user_id = (
        appointment.patient_id
        if current_user.role.value in ["doctor", "admin"]
        else db.query(DoctorProfile).filter(DoctorProfile.id == appointment.doctor_id).first().user_id
    )
    notification = Notification(
        user_id=notification_user_id,
        title="Appointment Updated",
        message=f"Your appointment on {appointment.appointment_date} has been updated.",
        notification_type="appointment",
    )
    db.add(notification)
    db.commit()
    db.refresh(appointment)

    return (
        db.query(Appointment)
        .options(
            joinedload(Appointment.patient),
            joinedload(Appointment.doctor).joinedload(DoctorProfile.user),
            joinedload(Appointment.doctor).joinedload(DoctorProfile.specialization),
        )
        .filter(Appointment.id == appointment.id)
        .first()
    )

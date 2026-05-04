from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
from app.database import get_db
from app.models.models import User, DoctorProfile, Specialization
from app.schemas.schemas import (
    DoctorProfileCreate, DoctorProfileUpdate, DoctorProfileResponse,
    DoctorListResponse, DoctorScheduleCreate, DoctorScheduleUpdate,
    DoctorScheduleResponse, SpecializationCreate, SpecializationResponse,
)
from app.utils.auth import get_current_user, get_current_active_doctor, get_current_admin
from app.utils.slots import generate_slots_for_next_days
from app.models.models import DoctorSchedule

router = APIRouter(prefix="/api/doctors", tags=["Doctors"])


# ─── Specializations ────────────────────────────────────────────────

@router.get("/specializations", response_model=List[SpecializationResponse])
def list_specializations(db: Session = Depends(get_db)):
    """List all medical specializations."""
    return db.query(Specialization).order_by(Specialization.name).all()


@router.post("/specializations", response_model=SpecializationResponse, status_code=201)
def create_specialization(
    data: SpecializationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    """Create a new specialization (Admin only)."""
    existing = db.query(Specialization).filter(Specialization.name == data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Specialization already exists")
    spec = Specialization(**data.model_dump())
    db.add(spec)
    db.commit()
    db.refresh(spec)
    return spec


# ─── Doctor Profiles ─────────────────────────────────────────────────

@router.get("/", response_model=List[DoctorListResponse])
def list_doctors(
    specialization_id: Optional[int] = None,
    search: Optional[str] = None,
    min_rating: Optional[float] = Query(None, ge=0, le=5),
    min_experience: Optional[int] = None,
    max_fee: Optional[float] = None,
    city: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """Search and list doctors with filters."""
    query = (
        db.query(DoctorProfile)
        .options(joinedload(DoctorProfile.user), joinedload(DoctorProfile.specialization))
        .filter(DoctorProfile.is_available == True)
    )

    if specialization_id:
        query = query.filter(DoctorProfile.specialization_id == specialization_id)
    if min_rating:
        query = query.filter(DoctorProfile.average_rating >= min_rating)
    if min_experience:
        query = query.filter(DoctorProfile.experience_years >= min_experience)
    if max_fee:
        query = query.filter(DoctorProfile.consultation_fee <= max_fee)
    if search:
        query = query.join(User).filter(
            or_(
                User.first_name.ilike(f"%{search}%"),
                User.last_name.ilike(f"%{search}%"),
            )
        )
    if city:
        query = query.join(User).filter(User.city.ilike(f"%{city}%"))

    doctors = query.offset((page - 1) * per_page).limit(per_page).all()
    return doctors


@router.get("/{doctor_id}", response_model=DoctorProfileResponse)
def get_doctor(doctor_id: int, db: Session = Depends(get_db)):
    """Get a doctor's full profile."""
    doctor = (
        db.query(DoctorProfile)
        .options(joinedload(DoctorProfile.user), joinedload(DoctorProfile.specialization))
        .filter(DoctorProfile.id == doctor_id)
        .first()
    )
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    return doctor


@router.post("/profile", response_model=DoctorProfileResponse, status_code=201)
def create_doctor_profile(
    data: DoctorProfileCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_doctor),
):
    """Create doctor profile (for registered doctor users)."""
    existing = db.query(DoctorProfile).filter(DoctorProfile.user_id == current_user.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Doctor profile already exists")

    spec = db.query(Specialization).filter(Specialization.id == data.specialization_id).first()
    if not spec:
        raise HTTPException(status_code=404, detail="Specialization not found")

    profile = DoctorProfile(user_id=current_user.id, **data.model_dump())
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return (
        db.query(DoctorProfile)
        .options(joinedload(DoctorProfile.user), joinedload(DoctorProfile.specialization))
        .filter(DoctorProfile.id == profile.id)
        .first()
    )


@router.put("/profile", response_model=DoctorProfileResponse)
def update_doctor_profile(
    data: DoctorProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_doctor),
):
    """Update doctor's own profile."""
    profile = db.query(DoctorProfile).filter(DoctorProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Doctor profile not found. Create one first.")

    update_dict = data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(profile, key, value)
    db.commit()
    db.refresh(profile)
    return (
        db.query(DoctorProfile)
        .options(joinedload(DoctorProfile.user), joinedload(DoctorProfile.specialization))
        .filter(DoctorProfile.id == profile.id)
        .first()
    )


# ─── Doctor Schedule ─────────────────────────────────────────────────

@router.get("/{doctor_id}/schedules", response_model=List[DoctorScheduleResponse])
def get_doctor_schedules(doctor_id: int, db: Session = Depends(get_db)):
    """Get a doctor's weekly schedule."""
    return (
        db.query(DoctorSchedule)
        .filter(DoctorSchedule.doctor_id == doctor_id)
        .order_by(DoctorSchedule.day_of_week)
        .all()
    )


@router.post("/schedules", response_model=DoctorScheduleResponse, status_code=201)
def create_schedule(
    data: DoctorScheduleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_doctor),
):
    """Add a weekly schedule slot for the doctor."""
    profile = db.query(DoctorProfile).filter(DoctorProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Create doctor profile first")

    if data.start_time >= data.end_time:
        raise HTTPException(status_code=400, detail="Start time must be before end time")

    existing = (
        db.query(DoctorSchedule)
        .filter(
            DoctorSchedule.doctor_id == profile.id,
            DoctorSchedule.day_of_week == data.day_of_week,
            DoctorSchedule.start_time == data.start_time,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Schedule for this day and time already exists")

    schedule = DoctorSchedule(doctor_id=profile.id, **data.model_dump())
    db.add(schedule)
    db.commit()
    db.refresh(schedule)

    # Auto-generate time slots for the next 14 days
    generate_slots_for_next_days(db, profile.id, days_ahead=14)
    return schedule


@router.put("/schedules/{schedule_id}", response_model=DoctorScheduleResponse)
def update_schedule(
    schedule_id: int,
    data: DoctorScheduleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_doctor),
):
    """Update a schedule slot."""
    profile = db.query(DoctorProfile).filter(DoctorProfile.user_id == current_user.id).first()
    schedule = (
        db.query(DoctorSchedule)
        .filter(DoctorSchedule.id == schedule_id, DoctorSchedule.doctor_id == profile.id)
        .first()
    )
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    update_dict = data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(schedule, key, value)
    db.commit()
    db.refresh(schedule)
    return schedule


@router.delete("/schedules/{schedule_id}")
def delete_schedule(
    schedule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_doctor),
):
    """Delete a schedule slot."""
    profile = db.query(DoctorProfile).filter(DoctorProfile.user_id == current_user.id).first()
    schedule = (
        db.query(DoctorSchedule)
        .filter(DoctorSchedule.id == schedule_id, DoctorSchedule.doctor_id == profile.id)
        .first()
    )
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    db.delete(schedule)
    db.commit()
    return {"message": "Schedule deleted successfully"}


@router.post("/{doctor_id}/generate-slots")
def generate_doctor_slots(
    doctor_id: int,
    days: int = Query(14, ge=1, le=30),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_doctor),
):
    """Manually generate time slots for a doctor."""
    profile = db.query(DoctorProfile).filter(DoctorProfile.user_id == current_user.id).first()
    if not profile or profile.id != doctor_id:
        raise HTTPException(status_code=403, detail="You can only generate slots for your own profile")

    total = generate_slots_for_next_days(db, doctor_id, days_ahead=days)
    return {"message": f"{total} new time slots generated for the next {days} days"}

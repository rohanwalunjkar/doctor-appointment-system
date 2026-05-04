from datetime import date, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from app.database import get_db
from app.models.models import (
    User, Appointment, DoctorProfile, Review,
    AppointmentStatus, UserRole,
)
from app.schemas.schemas import DashboardStats
from app.utils.auth import get_current_user, get_current_admin

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard & Analytics"])


@router.get("/patient/stats", response_model=DashboardStats)
def get_patient_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get dashboard stats for a patient."""
    base_query = db.query(Appointment).filter(Appointment.patient_id == current_user.id)
    return DashboardStats(
        total_appointments=base_query.count(),
        pending_appointments=base_query.filter(Appointment.status == AppointmentStatus.PENDING).count(),
        completed_appointments=base_query.filter(Appointment.status == AppointmentStatus.COMPLETED).count(),
        cancelled_appointments=base_query.filter(Appointment.status == AppointmentStatus.CANCELLED).count(),
    )


@router.get("/doctor/stats", response_model=DashboardStats)
def get_doctor_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get dashboard stats for a doctor."""
    profile = db.query(DoctorProfile).filter(DoctorProfile.user_id == current_user.id).first()
    if not profile:
        return DashboardStats(
            total_appointments=0, pending_appointments=0,
            completed_appointments=0, cancelled_appointments=0,
        )

    base_query = db.query(Appointment).filter(Appointment.doctor_id == profile.id)

    # Calculate total revenue from completed appointments
    total_revenue = (
        base_query.filter(Appointment.status == AppointmentStatus.COMPLETED).count()
        * profile.consultation_fee
    )

    return DashboardStats(
        total_appointments=base_query.count(),
        pending_appointments=base_query.filter(Appointment.status == AppointmentStatus.PENDING).count(),
        completed_appointments=base_query.filter(Appointment.status == AppointmentStatus.COMPLETED).count(),
        cancelled_appointments=base_query.filter(Appointment.status == AppointmentStatus.CANCELLED).count(),
        total_patients=profile.total_patients,
        total_revenue=total_revenue,
        average_rating=profile.average_rating,
    )


@router.get("/admin/stats", response_model=DashboardStats)
def get_admin_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    """Get dashboard stats for admin."""
    base_query = db.query(Appointment)
    total_doctors = db.query(User).filter(User.role == UserRole.DOCTOR).count()
    total_patients = db.query(User).filter(User.role == UserRole.PATIENT).count()

    total_revenue = (
        db.query(func.sum(DoctorProfile.consultation_fee))
        .join(Appointment, Appointment.doctor_id == DoctorProfile.id)
        .filter(Appointment.status == AppointmentStatus.COMPLETED)
        .scalar()
    ) or 0

    return DashboardStats(
        total_appointments=base_query.count(),
        pending_appointments=base_query.filter(Appointment.status == AppointmentStatus.PENDING).count(),
        completed_appointments=base_query.filter(Appointment.status == AppointmentStatus.COMPLETED).count(),
        cancelled_appointments=base_query.filter(Appointment.status == AppointmentStatus.CANCELLED).count(),
        total_doctors=total_doctors,
        total_patients=total_patients,
        total_revenue=total_revenue,
    )


@router.get("/admin/appointment-trends")
def get_appointment_trends(
    days: int = Query(30, ge=7, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    """Get appointment trends over time (Admin)."""
    start_date = date.today() - timedelta(days=days)
    results = (
        db.query(
            Appointment.appointment_date,
            func.count(Appointment.id).label("count"),
        )
        .filter(Appointment.appointment_date >= start_date)
        .group_by(Appointment.appointment_date)
        .order_by(Appointment.appointment_date)
        .all()
    )
    return [{"date": str(r.appointment_date), "count": r.count} for r in results]


@router.get("/admin/top-doctors")
def get_top_doctors(
    limit: int = Query(5, ge=1, le=20),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    """Get top-rated doctors (Admin)."""
    doctors = (
        db.query(DoctorProfile)
        .join(User, User.id == DoctorProfile.user_id)
        .order_by(DoctorProfile.average_rating.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "doctor_id": d.id,
            "name": f"Dr. {d.user.first_name} {d.user.last_name}",
            "rating": d.average_rating,
            "total_reviews": d.total_reviews,
            "total_patients": d.total_patients,
            "consultation_fee": d.consultation_fee,
        }
        for d in doctors
    ]

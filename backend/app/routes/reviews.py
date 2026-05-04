from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from app.database import get_db
from app.models.models import User, Review, DoctorProfile, Appointment, AppointmentStatus
from app.schemas.schemas import ReviewCreate, ReviewResponse
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/reviews", tags=["Reviews"])


@router.post("/", response_model=ReviewResponse, status_code=201)
def create_review(
    data: ReviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submit a review for a completed appointment."""
    appointment = db.query(Appointment).filter(Appointment.id == data.appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if appointment.patient_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only review your own appointments")
    if appointment.status != AppointmentStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="You can only review completed appointments")

    existing = db.query(Review).filter(Review.appointment_id == data.appointment_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="You have already reviewed this appointment")

    review = Review(
        patient_id=current_user.id,
        doctor_id=appointment.doctor_id,
        appointment_id=data.appointment_id,
        rating=data.rating,
        comment=data.comment,
    )
    db.add(review)

    # Update doctor's average rating
    doctor = db.query(DoctorProfile).filter(DoctorProfile.id == appointment.doctor_id).first()
    if doctor:
        avg_rating = (
            db.query(func.avg(Review.rating))
            .filter(Review.doctor_id == doctor.id)
            .scalar()
        )
        total_reviews = db.query(Review).filter(Review.doctor_id == doctor.id).count()
        # Include the new review in calculation
        doctor.average_rating = round(
            ((avg_rating or 0) * total_reviews + data.rating) / (total_reviews + 1), 2
        )
        doctor.total_reviews = total_reviews + 1

    db.commit()
    db.refresh(review)
    return (
        db.query(Review)
        .options(joinedload(Review.patient))
        .filter(Review.id == review.id)
        .first()
    )


@router.get("/doctor/{doctor_id}", response_model=List[ReviewResponse])
def get_doctor_reviews(
    doctor_id: int,
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """Get all reviews for a doctor."""
    reviews = (
        db.query(Review)
        .options(joinedload(Review.patient))
        .filter(Review.doctor_id == doctor_id)
        .order_by(Review.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    return reviews

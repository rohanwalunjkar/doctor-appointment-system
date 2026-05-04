import enum
from datetime import datetime, date, time
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, Date, Time,
    ForeignKey, Enum, Float, UniqueConstraint, Index
)
from sqlalchemy.orm import relationship
from app.database import Base


# ─── Enums ───────────────────────────────────────────────────────────

class UserRole(str, enum.Enum):
    PATIENT = "patient"
    DOCTOR = "doctor"
    ADMIN = "admin"


class Gender(str, enum.Enum):
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"


class AppointmentStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"


class DayOfWeek(str, enum.Enum):
    MONDAY = "monday"
    TUESDAY = "tuesday"
    WEDNESDAY = "wednesday"
    THURSDAY = "thursday"
    FRIDAY = "friday"
    SATURDAY = "saturday"
    SUNDAY = "sunday"


# ─── User Model ──────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    phone = Column(String(20), nullable=True)
    role = Column(Enum(UserRole), default=UserRole.PATIENT, nullable=False)
    gender = Column(Enum(Gender), nullable=True)
    date_of_birth = Column(Date, nullable=True)
    address = Column(Text, nullable=True)
    city = Column(String(100), nullable=True)
    profile_image = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    doctor_profile = relationship("DoctorProfile", back_populates="user", uselist=False)
    patient_appointments = relationship(
        "Appointment", back_populates="patient", foreign_keys="Appointment.patient_id"
    )
    reviews_given = relationship("Review", back_populates="patient", foreign_keys="Review.patient_id")
    notifications = relationship("Notification", back_populates="user")


# ─── Specialization ─────────────────────────────────────────────────

class Specialization(Base):
    __tablename__ = "specializations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    icon = Column(String(100), nullable=True)

    doctors = relationship("DoctorProfile", back_populates="specialization")


# ─── Doctor Profile ──────────────────────────────────────────────────

class DoctorProfile(Base):
    __tablename__ = "doctor_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    specialization_id = Column(Integer, ForeignKey("specializations.id"), nullable=False)
    qualification = Column(String(500), nullable=False)
    experience_years = Column(Integer, default=0)
    consultation_fee = Column(Float, nullable=False)
    bio = Column(Text, nullable=True)
    hospital_name = Column(String(300), nullable=True)
    hospital_address = Column(Text, nullable=True)
    average_rating = Column(Float, default=0.0)
    total_reviews = Column(Integer, default=0)
    total_patients = Column(Integer, default=0)
    is_available = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="doctor_profile")
    specialization = relationship("Specialization", back_populates="doctors")
    schedules = relationship("DoctorSchedule", back_populates="doctor", cascade="all, delete-orphan")
    appointments = relationship("Appointment", back_populates="doctor")
    reviews = relationship("Review", back_populates="doctor")


# ─── Doctor Schedule (Weekly recurring time slots) ───────────────────

class DoctorSchedule(Base):
    __tablename__ = "doctor_schedules"

    id = Column(Integer, primary_key=True, index=True)
    doctor_id = Column(Integer, ForeignKey("doctor_profiles.id"), nullable=False)
    day_of_week = Column(Enum(DayOfWeek), nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    slot_duration_minutes = Column(Integer, default=30)  # each slot duration
    max_patients_per_slot = Column(Integer, default=1)
    is_active = Column(Boolean, default=True)

    __table_args__ = (
        UniqueConstraint("doctor_id", "day_of_week", "start_time", name="uq_doctor_day_time"),
    )

    doctor = relationship("DoctorProfile", back_populates="schedules")


# ─── Time Slot (Generated daily slots) ──────────────────────────────

class TimeSlot(Base):
    __tablename__ = "time_slots"

    id = Column(Integer, primary_key=True, index=True)
    doctor_id = Column(Integer, ForeignKey("doctor_profiles.id"), nullable=False)
    date = Column(Date, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    is_booked = Column(Boolean, default=False)
    is_blocked = Column(Boolean, default=False)  # doctor can block specific slots

    __table_args__ = (
        UniqueConstraint("doctor_id", "date", "start_time", name="uq_doctor_date_time"),
        Index("idx_doctor_date", "doctor_id", "date"),
    )

    doctor = relationship("DoctorProfile")
    appointment = relationship("Appointment", back_populates="time_slot", uselist=False)


# ─── Appointment ─────────────────────────────────────────────────────

class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("doctor_profiles.id"), nullable=False)
    time_slot_id = Column(Integer, ForeignKey("time_slots.id"), nullable=True)
    appointment_date = Column(Date, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    status = Column(Enum(AppointmentStatus), default=AppointmentStatus.PENDING)
    reason = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)  # doctor's notes
    prescription = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("idx_patient_date", "patient_id", "appointment_date"),
        Index("idx_doctor_date_appt", "doctor_id", "appointment_date"),
    )

    patient = relationship("User", back_populates="patient_appointments")
    doctor = relationship("DoctorProfile", back_populates="appointments")
    time_slot = relationship("TimeSlot", back_populates="appointment")
    review = relationship("Review", back_populates="appointment", uselist=False)


# ─── Review / Rating ────────────────────────────────────────────────

class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("doctor_profiles.id"), nullable=False)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), unique=True, nullable=False)
    rating = Column(Integer, nullable=False)  # 1-5
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("User", back_populates="reviews_given")
    doctor = relationship("DoctorProfile", back_populates="reviews")
    appointment = relationship("Appointment", back_populates="review")


# ─── Notification ────────────────────────────────────────────────────

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(300), nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    notification_type = Column(String(50), nullable=True)  # appointment, reminder, system
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="notifications")

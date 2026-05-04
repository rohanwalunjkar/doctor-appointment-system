from datetime import date, time, datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field
from app.models.models import UserRole, Gender, AppointmentStatus, DayOfWeek


# ─── Auth Schemas ────────────────────────────────────────────────────

class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=100)
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    phone: Optional[str] = None
    role: UserRole = UserRole.PATIENT
    gender: Optional[Gender] = None
    date_of_birth: Optional[date] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: Optional[int] = None
    role: Optional[str] = None


class RefreshTokenRequest(BaseModel):
    refresh_token: str


# ─── User Schemas ────────────────────────────────────────────────────

class UserBase(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    phone: Optional[str] = None
    gender: Optional[Gender] = None
    date_of_birth: Optional[date] = None
    address: Optional[str] = None
    city: Optional[str] = None
    profile_image: Optional[str] = None


class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    gender: Optional[Gender] = None
    date_of_birth: Optional[date] = None
    address: Optional[str] = None
    city: Optional[str] = None
    profile_image: Optional[str] = None


class UserResponse(UserBase):
    id: int
    role: UserRole
    is_active: bool
    is_verified: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ChangePassword(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6, max_length=100)


# ─── Specialization Schemas ─────────────────────────────────────────

class SpecializationCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    icon: Optional[str] = None


class SpecializationResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None

    class Config:
        from_attributes = True


# ─── Doctor Profile Schemas ──────────────────────────────────────────

class DoctorProfileCreate(BaseModel):
    specialization_id: int
    qualification: str
    experience_years: int = Field(ge=0)
    consultation_fee: float = Field(gt=0)
    bio: Optional[str] = None
    hospital_name: Optional[str] = None
    hospital_address: Optional[str] = None


class DoctorProfileUpdate(BaseModel):
    specialization_id: Optional[int] = None
    qualification: Optional[str] = None
    experience_years: Optional[int] = None
    consultation_fee: Optional[float] = None
    bio: Optional[str] = None
    hospital_name: Optional[str] = None
    hospital_address: Optional[str] = None
    is_available: Optional[bool] = None


class DoctorProfileResponse(BaseModel):
    id: int
    user_id: int
    specialization: SpecializationResponse
    qualification: str
    experience_years: int
    consultation_fee: float
    bio: Optional[str] = None
    hospital_name: Optional[str] = None
    hospital_address: Optional[str] = None
    average_rating: float
    total_reviews: int
    total_patients: int
    is_available: bool
    user: UserResponse

    class Config:
        from_attributes = True


class DoctorListResponse(BaseModel):
    id: int
    user: UserResponse
    specialization: SpecializationResponse
    qualification: str
    experience_years: int
    consultation_fee: float
    hospital_name: Optional[str] = None
    average_rating: float
    total_reviews: int
    is_available: bool

    class Config:
        from_attributes = True


# ─── Doctor Schedule Schemas ─────────────────────────────────────────

class DoctorScheduleCreate(BaseModel):
    day_of_week: DayOfWeek
    start_time: time
    end_time: time
    slot_duration_minutes: int = Field(default=30, ge=10, le=120)
    max_patients_per_slot: int = Field(default=1, ge=1)


class DoctorScheduleUpdate(BaseModel):
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    slot_duration_minutes: Optional[int] = None
    max_patients_per_slot: Optional[int] = None
    is_active: Optional[bool] = None


class DoctorScheduleResponse(BaseModel):
    id: int
    doctor_id: int
    day_of_week: DayOfWeek
    start_time: time
    end_time: time
    slot_duration_minutes: int
    max_patients_per_slot: int
    is_active: bool

    class Config:
        from_attributes = True


# ─── Time Slot Schemas ───────────────────────────────────────────────

class TimeSlotResponse(BaseModel):
    id: int
    doctor_id: int
    date: date
    start_time: time
    end_time: time
    is_booked: bool
    is_blocked: bool

    class Config:
        from_attributes = True


class TimeSlotBlock(BaseModel):
    slot_ids: List[int]
    reason: Optional[str] = None


# ─── Appointment Schemas ─────────────────────────────────────────────

class AppointmentCreate(BaseModel):
    doctor_id: int
    time_slot_id: int
    reason: Optional[str] = None


class AppointmentUpdate(BaseModel):
    status: Optional[AppointmentStatus] = None
    notes: Optional[str] = None
    prescription: Optional[str] = None


class AppointmentResponse(BaseModel):
    id: int
    patient_id: int
    doctor_id: int
    time_slot_id: Optional[int] = None
    appointment_date: date
    start_time: time
    end_time: time
    status: AppointmentStatus
    reason: Optional[str] = None
    notes: Optional[str] = None
    prescription: Optional[str] = None
    created_at: datetime
    patient: UserResponse
    doctor: DoctorProfileResponse

    class Config:
        from_attributes = True


# ─── Review Schemas ──────────────────────────────────────────────────

class ReviewCreate(BaseModel):
    appointment_id: int
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None


class ReviewResponse(BaseModel):
    id: int
    patient_id: int
    doctor_id: int
    appointment_id: int
    rating: int
    comment: Optional[str] = None
    created_at: datetime
    patient: UserResponse

    class Config:
        from_attributes = True


# ─── Notification Schemas ────────────────────────────────────────────

class NotificationResponse(BaseModel):
    id: int
    title: str
    message: str
    is_read: bool
    notification_type: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Dashboard / Analytics Schemas ───────────────────────────────────

class DashboardStats(BaseModel):
    total_appointments: int
    pending_appointments: int
    completed_appointments: int
    cancelled_appointments: int
    total_patients: Optional[int] = None
    total_doctors: Optional[int] = None
    total_revenue: Optional[float] = None
    average_rating: Optional[float] = None


class PaginatedResponse(BaseModel):
    items: list
    total: int
    page: int
    per_page: int
    total_pages: int

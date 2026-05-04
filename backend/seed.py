"""Seed script to populate the database with initial data."""
from app.database import SessionLocal, engine, Base
from app.models.models import User, Specialization, DoctorProfile, DoctorSchedule, UserRole, Gender, DayOfWeek
from app.utils.auth import hash_password
from app.utils.slots import generate_slots_for_next_days
from datetime import time


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # Check if data already exists
        if db.query(User).first():
            print("Database already seeded. Skipping...")
            return

        # ─── Specializations ──────────────────────────
        specializations = [
            Specialization(name="General Medicine", description="Primary care and general health", icon="🩺"),
            Specialization(name="Cardiology", description="Heart and cardiovascular system", icon="❤️"),
            Specialization(name="Dermatology", description="Skin, hair, and nails", icon="🧴"),
            Specialization(name="Orthopedics", description="Bones, joints, and muscles", icon="🦴"),
            Specialization(name="Pediatrics", description="Children's health", icon="👶"),
            Specialization(name="Neurology", description="Brain and nervous system", icon="🧠"),
            Specialization(name="Ophthalmology", description="Eye care and vision", icon="👁️"),
            Specialization(name="Dentistry", description="Oral health and dental care", icon="🦷"),
            Specialization(name="Psychiatry", description="Mental health and behavioral disorders", icon="🧘"),
            Specialization(name="Gynecology", description="Women's reproductive health", icon="🏥"),
        ]
        db.add_all(specializations)
        db.flush()

        # ─── Admin User ──────────────────────────────
        admin = User(
            email="admin@docbook.com",
            hashed_password=hash_password("admin123"),
            first_name="System",
            last_name="Admin",
            phone="1234567890",
            role=UserRole.ADMIN,
            gender=Gender.MALE,
            is_active=True,
            is_verified=True,
        )
        db.add(admin)

        # ─── Sample Doctors ──────────────────────────
        doctors_data = [
            {
                "email": "dr.smith@docbook.com", "first_name": "John", "last_name": "Smith",
                "phone": "9876543210", "gender": Gender.MALE, "city": "New York",
                "spec_idx": 0, "qualification": "MBBS, MD - General Medicine",
                "experience": 15, "fee": 500.0, "bio": "Experienced general physician with 15+ years of practice.",
                "hospital": "City General Hospital",
            },
            {
                "email": "dr.patel@docbook.com", "first_name": "Priya", "last_name": "Patel",
                "phone": "9876543211", "gender": Gender.FEMALE, "city": "Los Angeles",
                "spec_idx": 1, "qualification": "MBBS, DM - Cardiology",
                "experience": 12, "fee": 800.0, "bio": "Expert cardiologist specializing in interventional cardiology.",
                "hospital": "Heart Care Center",
            },
            {
                "email": "dr.johnson@docbook.com", "first_name": "Emily", "last_name": "Johnson",
                "phone": "9876543212", "gender": Gender.FEMALE, "city": "Chicago",
                "spec_idx": 4, "qualification": "MBBS, MD - Pediatrics",
                "experience": 10, "fee": 600.0, "bio": "Dedicated pediatrician who loves working with children.",
                "hospital": "Children's Medical Center",
            },
            {
                "email": "dr.brown@docbook.com", "first_name": "Michael", "last_name": "Brown",
                "phone": "9876543213", "gender": Gender.MALE, "city": "Houston",
                "spec_idx": 2, "qualification": "MBBS, MD - Dermatology",
                "experience": 8, "fee": 700.0, "bio": "Skin specialist with expertise in cosmetic dermatology.",
                "hospital": "Skin & Wellness Clinic",
            },
            {
                "email": "dr.wilson@docbook.com", "first_name": "Sarah", "last_name": "Wilson",
                "phone": "9876543214", "gender": Gender.FEMALE, "city": "Phoenix",
                "spec_idx": 5, "qualification": "MBBS, DM - Neurology",
                "experience": 18, "fee": 900.0, "bio": "Senior neurologist specializing in movement disorders.",
                "hospital": "Neuro Sciences Institute",
            },
        ]

        for d in doctors_data:
            user = User(
                email=d["email"],
                hashed_password=hash_password("doctor123"),
                first_name=d["first_name"],
                last_name=d["last_name"],
                phone=d["phone"],
                role=UserRole.DOCTOR,
                gender=d["gender"],
                city=d["city"],
                is_active=True,
                is_verified=True,
            )
            db.add(user)
            db.flush()

            profile = DoctorProfile(
                user_id=user.id,
                specialization_id=specializations[d["spec_idx"]].id,
                qualification=d["qualification"],
                experience_years=d["experience"],
                consultation_fee=d["fee"],
                bio=d["bio"],
                hospital_name=d["hospital"],
                average_rating=4.0 + (d["experience"] % 10) / 10,
                total_reviews=d["experience"] * 3,
                total_patients=d["experience"] * 10,
                is_available=True,
            )
            db.add(profile)
            db.flush()

            # Add schedules (Mon-Fri, morning & afternoon)
            for day in [DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY]:
                morning = DoctorSchedule(
                    doctor_id=profile.id,
                    day_of_week=day,
                    start_time=time(9, 0),
                    end_time=time(13, 0),
                    slot_duration_minutes=30,
                    is_active=True,
                )
                afternoon = DoctorSchedule(
                    doctor_id=profile.id,
                    day_of_week=day,
                    start_time=time(14, 0),
                    end_time=time(18, 0),
                    slot_duration_minutes=30,
                    is_active=True,
                )
                db.add_all([morning, afternoon])

            db.flush()
            # Generate time slots for next 14 days
            generate_slots_for_next_days(db, profile.id, days_ahead=14)

        # ─── Sample Patients ──────────────────────────
        patients_data = [
            {"email": "patient1@test.com", "first_name": "Alice", "last_name": "Williams", "gender": Gender.FEMALE, "city": "New York"},
            {"email": "patient2@test.com", "first_name": "Bob", "last_name": "Davis", "gender": Gender.MALE, "city": "Los Angeles"},
            {"email": "patient3@test.com", "first_name": "Carol", "last_name": "Martinez", "gender": Gender.FEMALE, "city": "Chicago"},
        ]

        for p in patients_data:
            patient = User(
                email=p["email"],
                hashed_password=hash_password("patient123"),
                first_name=p["first_name"],
                last_name=p["last_name"],
                role=UserRole.PATIENT,
                gender=p["gender"],
                city=p["city"],
                is_active=True,
                is_verified=True,
            )
            db.add(patient)

        db.commit()
        print("✅ Database seeded successfully!")
        print("  Admin: admin@docbook.com / admin123")
        print("  Doctor: dr.smith@docbook.com / doctor123")
        print("  Patient: patient1@test.com / patient123")

    except Exception as e:
        db.rollback()
        print(f"❌ Seed failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()

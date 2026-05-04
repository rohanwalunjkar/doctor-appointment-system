from datetime import date, time, timedelta, datetime
from typing import List
from sqlalchemy.orm import Session
from app.models.models import DoctorSchedule, TimeSlot, DayOfWeek


DAY_MAP = {
    DayOfWeek.MONDAY: 0,
    DayOfWeek.TUESDAY: 1,
    DayOfWeek.WEDNESDAY: 2,
    DayOfWeek.THURSDAY: 3,
    DayOfWeek.FRIDAY: 4,
    DayOfWeek.SATURDAY: 5,
    DayOfWeek.SUNDAY: 6,
}


def generate_time_slots_for_date(
    db: Session,
    doctor_id: int,
    target_date: date,
    schedule: DoctorSchedule,
) -> List[TimeSlot]:
    """Generate individual time slots from a doctor's schedule for a specific date."""
    slots = []
    current_start = datetime.combine(target_date, schedule.start_time)
    end_dt = datetime.combine(target_date, schedule.end_time)
    duration = timedelta(minutes=schedule.slot_duration_minutes)

    while current_start + duration <= end_dt:
        slot_end = current_start + duration
        # Check if slot already exists
        existing = (
            db.query(TimeSlot)
            .filter(
                TimeSlot.doctor_id == doctor_id,
                TimeSlot.date == target_date,
                TimeSlot.start_time == current_start.time(),
            )
            .first()
        )
        if not existing:
            slot = TimeSlot(
                doctor_id=doctor_id,
                date=target_date,
                start_time=current_start.time(),
                end_time=slot_end.time(),
                is_booked=False,
                is_blocked=False,
            )
            db.add(slot)
            slots.append(slot)
        current_start = slot_end

    db.commit()
    return slots


def generate_slots_for_next_days(
    db: Session,
    doctor_id: int,
    days_ahead: int = 14,
) -> int:
    """Generate time slots for a doctor for the next N days based on their schedule."""
    schedules = (
        db.query(DoctorSchedule)
        .filter(DoctorSchedule.doctor_id == doctor_id, DoctorSchedule.is_active == True)
        .all()
    )
    total_created = 0
    today = date.today()

    for day_offset in range(days_ahead):
        target_date = today + timedelta(days=day_offset)
        weekday = target_date.weekday()

        for schedule in schedules:
            if DAY_MAP.get(schedule.day_of_week) == weekday:
                slots = generate_time_slots_for_date(db, doctor_id, target_date, schedule)
                total_created += len(slots)

    return total_created

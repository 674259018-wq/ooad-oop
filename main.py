"""Core OOP implementation for a small digital library management system.

Run this file directly to see a short borrowing/return demonstration:
    python main.py
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Optional


class User(ABC):
    """Abstract library member; subclasses define their own borrowing policy."""

    def __init__(self, user_id: str, name: str) -> None:
        if not user_id.strip():
            raise ValueError("User ID cannot be empty.")
        if not name.strip():
            raise ValueError("User name cannot be empty.")
        self.__user_id = user_id.strip()
        self._name = name.strip()
        self.__borrowed_book_ids: set[str] = set()

    @property
    def user_id(self) -> str:
        return self.__user_id

    @property
    def name(self) -> str:
        return self._name

    @property
    def borrowed_book_ids(self) -> frozenset[str]:
        return frozenset(self.__borrowed_book_ids)

    @abstractmethod
    def borrowing_limit(self) -> int:
        """Return the maximum number of books this member may borrow."""

    @abstractmethod
    def daily_fine(self) -> float:
        """Return the overdue fine per day in the system's currency."""

    def _add_borrowed_book(self, book_id: str) -> None:
        self.__borrowed_book_ids.add(book_id)

    def _remove_borrowed_book(self, book_id: str) -> None:
        self.__borrowed_book_ids.remove(book_id)

    def __str__(self) -> str:
        return f"{type(self).__name__}({self.user_id}: {self.name})"


class Student(User):
    """Student members may borrow up to three books; fine is 5 per day."""

    def borrowing_limit(self) -> int:
        return 3

    def daily_fine(self) -> float:
        return 5.0


class Teacher(User):
    """Teacher members may borrow up to five books; fine is 2 per day."""

    def borrowing_limit(self) -> int:
        return 5

    def daily_fine(self) -> float:
        return 2.0


class Book:
    """Book details and copy availability, with availability kept private."""

    def __init__(
        self, book_id: str, title: str, author: str, total_copies: int
    ) -> None:
        if not book_id.strip():
            raise ValueError("Book ID cannot be empty.")
        if not title.strip() or not author.strip():
            raise ValueError("Book title and author cannot be empty.")
        if total_copies < 0:
            raise ValueError("Total copies cannot be negative.")
        self.book_id = book_id.strip()
        self.title = title.strip()
        self.author = author.strip()
        self.__total_copies = total_copies
        self.__available_copies = total_copies

    @property
    def total_copies(self) -> int:
        return self.__total_copies

    @property
    def available_copies(self) -> int:
        return self.__available_copies

    def _checkout_copy(self) -> None:
        if self.__available_copies <= 0:
            raise ValueError(f"No available copies of '{self.title}'.")
        self.__available_copies -= 1

    def _return_copy(self) -> None:
        if self.__available_copies >= self.__total_copies:
            raise ValueError(f"All copies of '{self.title}' are already available.")
        self.__available_copies += 1

    def __str__(self) -> str:
        return (
            f"{self.title} by {self.author} "
            f"({self.__available_copies}/{self.__total_copies} available)"
        )


@dataclass
class BorrowRecord:
    """A single checkout, its due date, and its eventual return details."""

    user_id: str
    book_id: str
    borrowed_on: date
    due_on: date
    returned_on: Optional[date] = None
    fine: float = 0.0

    @property
    def is_active(self) -> bool:
        return self.returned_on is None


class LibrarySystem:
    """Coordinates members, books, borrowing rules, and return transactions."""

    def __init__(self, loan_days: int = 14) -> None:
        if loan_days <= 0:
            raise ValueError("Loan period must be a positive number of days.")
        self.loan_days = loan_days
        self._users: dict[str, User] = {}
        self._books: dict[str, Book] = {}
        self._records: list[BorrowRecord] = []

    @property
    def users(self) -> tuple[User, ...]:
        return tuple(self._users.values())

    @property
    def books(self) -> tuple[Book, ...]:
        return tuple(self._books.values())

    @property
    def records(self) -> tuple[BorrowRecord, ...]:
        return tuple(self._records)

    def register_user(self, user: User) -> None:
        if user.user_id in self._users:
            raise ValueError(f"User ID '{user.user_id}' is already registered.")
        self._users[user.user_id] = user

    def add_book(self, book: Book) -> None:
        if book.book_id in self._books:
            raise ValueError(f"Book ID '{book.book_id}' already exists.")
        self._books[book.book_id] = book

    def borrow_book(
        self, user_id: str, book_id: str, *, borrowed_on: Optional[date] = None
    ) -> BorrowRecord:
        user = self._get_user(user_id)
        book = self._get_book(book_id)
        if book.available_copies == 0:
            raise ValueError(f"No available copies of '{book.title}'.")
        if book.book_id in user.borrowed_book_ids:
            raise ValueError(f"{user.name} already has '{book.title}'.")
        if len(user.borrowed_book_ids) >= user.borrowing_limit():
            raise ValueError(
                f"{user.name} has reached the "
                f"{user.borrowing_limit()}-book borrowing limit."
            )

        checkout_date = borrowed_on or date.today()
        record = BorrowRecord(
            user_id=user.user_id,
            book_id=book.book_id,
            borrowed_on=checkout_date,
            due_on=checkout_date + timedelta(days=self.loan_days),
        )
        book._checkout_copy()
        user._add_borrowed_book(book.book_id)
        self._records.append(record)
        return record

    def return_book(
        self, user_id: str, book_id: str, *, returned_on: Optional[date] = None
    ) -> BorrowRecord:
        user = self._get_user(user_id)
        book = self._get_book(book_id)
        if book_id not in user.borrowed_book_ids:
            raise ValueError(f"{user.name} does not currently have '{book.title}'.")
        record = next(
            (
                item
                for item in reversed(self._records)
                if item.user_id == user_id
                and item.book_id == book_id
                and item.is_active
            ),
            None,
        )
        if record is None:
            raise RuntimeError("Active loan record is missing; data may be inconsistent.")

        return_date = returned_on or date.today()
        overdue_days = max((return_date - record.due_on).days, 0)
        record.returned_on = return_date
        record.fine = round(overdue_days * user.daily_fine(), 2)
        book._return_copy()
        user._remove_borrowed_book(book_id)
        return record

    def _get_user(self, user_id: str) -> User:
        try:
            return self._users[user_id]
        except KeyError as error:
            raise ValueError(f"Unknown user ID '{user_id}'.") from error

    def _get_book(self, book_id: str) -> Book:
        try:
            return self._books[book_id]
        except KeyError as error:
            raise ValueError(f"Unknown book ID '{book_id}'.") from error


def build_demo_library() -> LibrarySystem:
    """Create sample data used by the command-line demo."""
    library = LibrarySystem()
    library.register_user(Student("S001", "Mina Student"))
    library.register_user(Teacher("T001", "Alex Teacher"))
    library.add_book(Book("B001", "Clean Code", "Robert C. Martin", 3))
    library.add_book(Book("B002", "Design Patterns", "Erich Gamma et al.", 2))
    return library


if __name__ == "__main__":
    demo = build_demo_library()
    today = date.today()
    loan = demo.borrow_book("S001", "B001", borrowed_on=today)
    borrowed_book = next(book for book in demo.books if book.book_id == loan.book_id)
    print(f"Borrowed: {borrowed_book.title}; due {loan.due_on}")
    completed_loan = demo.return_book(
        "S001", "B001", returned_on=loan.due_on + timedelta(days=2)
    )
    print(f"Returned: fine = {completed_loan.fine:.2f}")

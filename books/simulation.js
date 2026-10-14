(function () {
  const storageKey = "digital-library-simulation-v1";
  const initialBooks = [
    { id: "B001", total: 3, available: 3, borrowers: [] },
    { id: "B002", total: 2, available: 2, borrowers: [] },
    { id: "B003", total: 4, available: 4, borrowers: [] },
    { id: "B004", total: 3, available: 3, borrowers: [] },
    { id: "B005", total: 3, available: 3, borrowers: [] },
    { id: "B006", total: 3, available: 3, borrowers: [] },
    { id: "B007", total: 3, available: 3, borrowers: [] },
    { id: "B008", total: 3, available: 3, borrowers: [] },
    { id: "B009", total: 3, available: 3, borrowers: [] },
    { id: "B010", total: 3, available: 3, borrowers: [] },
    { id: "B011", total: 3, available: 3, borrowers: [] },
    { id: "B012", total: 3, available: 3, borrowers: [] },
    { id: "B013", total: 3, available: 3, borrowers: [] },
    { id: "B014", total: 3, available: 3, borrowers: [] }
  ];

  function createInitialState() {
    const books = initialBooks.map(book => ({ ...book, borrowers: [...book.borrowers] }));
    const memberState = {
      student: { name: "Mina", type: "Student", limit: 3, finePerDay: 5, borrowed: [] },
      teacher: { name: "Alex", type: "Teacher", limit: 5, finePerDay: 2, borrowed: [] }
    };
    const borrowedAt = new Date();
    const loanRecords = [];
    return {
      version: 3,
      books,
      memberState,
      loanRecords,
      selectedMember: "student",
      memberSequence: 0,
      session: null
    };
  }

  function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  function load() {
    const serialized = localStorage.getItem(storageKey);
    if (serialized === null) {
      const initialState = createInitialState();
      save(initialState);
      return initialState;
    }
    const state = JSON.parse(serialized);
    if (
      ![1, 2, 3].includes(state?.version) ||
      !Array.isArray(state.books) ||
      !state.memberState ||
      !Array.isArray(state.loanRecords)
    ) {
      throw new Error("Saved library simulation data is invalid.");
    }
    state.loanRecords.forEach(record => {
      record.borrowedAt = new Date(record.borrowedAt);
      record.dueAt = new Date(record.dueAt);
      record.returnedAt = record.returnedAt ? new Date(record.returnedAt) : null;
    });
    initialBooks.forEach(initialBook => {
      if (!state.books.some(book => book.id === initialBook.id)) {
        state.books.push({ ...initialBook, borrowers: [] });
      }
    });
    state.books.forEach(book => {
      if (!initialBooks.some(initialBook => initialBook.id === book.id)) {
        throw new Error(`Saved library contains unknown book '${book.id}'.`);
      }
    });
    if (state.version === 1) {
      migrateSeedLoans(state);
    }
    state.session = state.session && state.memberState[state.session.memberKey]
      ? state.session
      : null;
    state.version = 3;
    save(state);
    return state;
  }

  function migrateSeedLoans(state) {
    const seedLoans = [
      { bookId: "B001", memberKey: "student" },
      { bookId: "B002", memberKey: "teacher" },
      { bookId: "B004", memberKey: "student" }
    ];
    seedLoans.forEach(({ bookId, memberKey }) => {
      const seedIndex = state.loanRecords.findIndex(record =>
        record.bookId === bookId && record.memberKey === memberKey
      );
      if (seedIndex === -1) return;
      const [seedLoan] = state.loanRecords.splice(seedIndex, 1);
      const hasLaterActiveLoan = state.loanRecords.some(record =>
        record.bookId === bookId && record.memberKey === memberKey && !record.returnedAt
      );
      if (!seedLoan.returnedAt && !hasLaterActiveLoan) {
        const book = state.books.find(item => item.id === bookId);
        if (book.borrowers.includes(memberKey)) {
          book.borrowers = book.borrowers.filter(key => key !== memberKey);
          book.available += 1;
        }
        const member = state.memberState[memberKey];
        if (member) {
          member.borrowed = member.borrowed.filter(id => id !== bookId);
        }
      }
    });
  }

  function save(state) {
    state.version = 3;
    state.memberSequence = state.memberSequence || 0;
    localStorage.setItem(storageKey, JSON.stringify(state));
  }

  function setSession(state, memberKey) {
    const member = state.memberState[memberKey];
    if (!member) {
      throw new Error("Cannot start a session for an unknown library member.");
    }
    state.session = { memberKey, name: member.name };
    state.selectedMember = memberKey;
    save(state);
  }

  function clearSession(state) {
    state.session = null;
    save(state);
  }

  function borrow(state, bookId, memberKey) {
    if (!state.session || state.session.memberKey !== memberKey) {
      return { ok: false, reason: "loginRequired" };
    }
    const book = state.books.find(item => item.id === bookId);
    const member = state.memberState[memberKey];
    if (!book || !member) {
      throw new Error("Book or member is missing from the library simulation.");
    }
    if (book.borrowers.includes(memberKey)) return { ok: false, reason: "alreadyBorrowed" };
    if (book.available <= 0) return { ok: false, reason: "unavailable" };
    if (member.borrowed.length >= member.limit) return { ok: false, reason: "limitReached" };

    const borrowedAt = new Date();
    book.borrowers.push(memberKey);
    book.available -= 1;
    member.borrowed.push(book.id);
    state.loanRecords.push({
      memberKey,
      bookId,
      borrowedAt,
      dueAt: addDays(borrowedAt, 14),
      returnedAt: null,
      fine: 0
    });
    state.selectedMember = memberKey;
    save(state);
    return { ok: true, action: "borrowed" };
  }

  function returnBook(state, bookId, memberKey, overdueDays) {
    if (!state.session || state.session.memberKey !== memberKey) {
      return { ok: false, reason: "loginRequired" };
    }
    const book = state.books.find(item => item.id === bookId);
    const member = state.memberState[memberKey];
    if (!book || !member) {
      throw new Error("Book or member is missing from the library simulation.");
    }
    if (!book.borrowers.includes(memberKey)) return { ok: false, reason: "notBorrowed" };

    const loan = state.loanRecords.slice().reverse().find(record =>
      record.memberKey === memberKey && record.bookId === bookId && !record.returnedAt
    );
    if (!loan) {
      throw new Error("Active loan record is missing for this return.");
    }
    const returnedAt = overdueDays > 0 ? addDays(loan.dueAt, overdueDays) : new Date();
    const actualOverdueDays = Math.max(Math.floor((returnedAt - loan.dueAt) / 86400000), 0);
    book.available += 1;
    book.borrowers = book.borrowers.filter(key => key !== memberKey);
    member.borrowed = member.borrowed.filter(id => id !== bookId);
    loan.returnedAt = returnedAt;
    loan.fine = Math.round(actualOverdueDays * member.finePerDay * 100) / 100;
    state.selectedMember = memberKey;
    save(state);
    return { ok: true, action: "returned", fine: loan.fine };
  }

  window.LibrarySimulation = { load, save, setSession, clearSession, borrow, returnBook };
})();

(function () {
  const themeStylesheet = document.createElement("link");
  themeStylesheet.rel = "stylesheet";
  themeStylesheet.href = "../theme.css";
  document.head.append(themeStylesheet);
  const themeScript = document.createElement("script");
  themeScript.src = "../theme.js";
  document.body.append(themeScript);

  const bookId = document.body.dataset.bookId;
  let state = window.LibrarySimulation.load();
  const bookInfo = window.LibraryBookCatalog[bookId];
  if (!bookInfo) {
    throw new Error(`Book '${bookId}' is missing from the catalog.`);
  }
  const pageTitle = document.getElementById("book-title");
  const pageMetadata = document.getElementById("book-metadata");
  const pageAuthor = document.getElementById("book-author");
  const pageCover = document.getElementById("book-cover");
  const pageDescription = document.getElementById("book-description");
  document.title = `${bookInfo.title} — ห้องสมุดดิจิทัล`;
  pageTitle.textContent = bookInfo.title;
  pageMetadata.textContent = `รหัสหนังสือ ${bookId} · ${bookInfo.category}`;
  pageAuthor.textContent = `ผู้เขียน: ${bookInfo.author}`;
  pageCover.src = `../images/books/${bookInfo.cover}`;
  pageCover.alt = `ปกหนังสือ ${bookInfo.title}`;
  pageDescription.textContent = bookInfo.description;
  const actions = document.getElementById("book-actions");
  const availability = document.createElement("p");
  availability.className = "mt-4 text-sm text-zinc-600";
  availability.setAttribute("aria-live", "polite");

  const overdueLabel = document.createElement("label");
  overdueLabel.className = "mt-4 flex items-center gap-2 text-sm text-zinc-600";
  const overdueToggle = document.createElement("input");
  overdueToggle.type = "checkbox";
  overdueToggle.className = "accent-black";
  const overdueText = document.createElement("span");
  overdueText.textContent = "จำลองคืนเกินกำหนด 2 วัน";
  overdueLabel.append(overdueToggle, overdueText);

  const loginLink = document.createElement("a");
  loginLink.href = "../index.html#login";
  loginLink.className = "mt-5 inline-flex rounded-xl bg-zinc-950 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-800";
  loginLink.textContent = "เข้าสู่ระบบเพื่อยืมหรือคืนหนังสือ";
  loginLink.hidden = true;

  const actionButton = document.createElement("button");
  actionButton.type = "button";
  actionButton.className = "mt-5 w-full rounded-xl bg-zinc-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400 sm:w-auto";

  const message = document.createElement("p");
  message.className = "mt-3 min-h-5 text-sm text-zinc-600";
  message.setAttribute("aria-live", "polite");
  actions.append(availability, loginLink, overdueLabel, actionButton, message);

  function render() {
    state = window.LibrarySimulation.load();
    const book = state.books.find(item => item.id === bookId);
    if (!book) {
      throw new Error("Book is missing from the library simulation.");
    }
    const memberKey = state.session?.memberKey;
    const member = memberKey ? state.memberState[memberKey] : null;
    if (memberKey && !member) {
      throw new Error("Active session refers to a missing library member.");
    }
    const isBorrowed = Boolean(memberKey && book.borrowers.includes(memberKey));
    const canBorrow = Boolean(member && book.available > 0 && member.borrowed.length < member.limit);
    availability.textContent = `สถานะหนังสือ: พร้อมยืม ${book.available}/${book.total} เล่ม`;
    availability.textContent += member
      ? ` · สมาชิก: ${member.name}`
      : " · กรุณาเข้าสู่ระบบก่อนทำรายการ";
    loginLink.hidden = Boolean(member);
    actionButton.hidden = !member;
    actionButton.textContent = isBorrowed ? "คืนหนังสือ" : "ยืมหนังสือ";
    actionButton.disabled = !isBorrowed && !canBorrow;
    overdueLabel.hidden = !isBorrowed;
    if (member && !isBorrowed && !canBorrow) {
      message.textContent = book.available === 0 ? "หนังสือถูกยืมหมดแล้ว" : "สมาชิกยืมครบตามโควตาแล้ว";
    } else if (!member) {
      message.textContent = "";
    }
  }

  actionButton.addEventListener("click", () => {
    state = window.LibrarySimulation.load();
    if (!state.session) {
      render();
      return;
    }
    const memberKey = state.session.memberKey;
    const book = state.books.find(item => item.id === bookId);
    if (book.borrowers.includes(memberKey)) {
      const result = window.LibrarySimulation.returnBook(
        state,
        bookId,
        memberKey,
        overdueToggle.checked ? 2 : 0
      );
      message.textContent = result.fine
        ? `คืนหนังสือเรียบร้อย · ค่าปรับ ฿${result.fine}`
        : "คืนหนังสือเรียบร้อย";
    } else {
      const result = window.LibrarySimulation.borrow(state, bookId, memberKey);
      message.textContent = result.ok
        ? "ยืมหนังสือเรียบร้อย · กำหนดคืนใน 14 วัน"
        : result.reason === "limitReached" ? "สมาชิกยืมครบตามโควตาแล้ว" : "หนังสือไม่พร้อมให้ยืม";
    }
    render();
  });

  window.addEventListener("storage", event => {
    if (event.key === "digital-library-simulation-v1") {
      render();
    }
  });

  render();
})();

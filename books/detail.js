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

  const actionButton = document.createElement("button");
  actionButton.type = "button";
  actionButton.className = "mt-5 w-full rounded-xl px-5 py-3 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400 sm:w-auto";

  const message = document.createElement("p");
  message.className = "mt-3 min-h-5 text-sm text-zinc-600";
  message.setAttribute("aria-live", "polite");
  actions.append(availability, overdueLabel, actionButton, message);

  const noticeOverlay = document.createElement("div");
  noticeOverlay.className = "fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm";
  noticeOverlay.hidden = true;
  noticeOverlay.style.display = "none";
  noticeOverlay.setAttribute("role", "presentation");

  const noticeDialog = document.createElement("section");
  noticeDialog.className = "w-full max-w-sm rounded-3xl border border-zinc-200 bg-white p-6 text-center shadow-2xl sm:p-8";
  noticeDialog.setAttribute("role", "dialog");
  noticeDialog.setAttribute("aria-modal", "true");
  noticeDialog.setAttribute("aria-labelledby", "notice-title");
  noticeDialog.setAttribute("aria-describedby", "notice-description");

  const noticeIcon = document.createElement("div");
  noticeIcon.className = "mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-3xl font-semibold text-emerald-700";
  noticeIcon.setAttribute("aria-hidden", "true");
  noticeIcon.textContent = "✓";

  const noticeTitle = document.createElement("h2");
  noticeTitle.id = "notice-title";
  noticeTitle.className = "mt-5 text-2xl font-semibold tracking-tight text-zinc-950";

  const noticeDescription = document.createElement("p");
  noticeDescription.id = "notice-description";
  noticeDescription.className = "mt-2 leading-6 text-zinc-600";

  const noticeClose = document.createElement("button");
  noticeClose.type = "button";
  noticeClose.className = "mt-7 w-full rounded-xl bg-zinc-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-zinc-800";
  noticeClose.textContent = "ตกลง";
  noticeDialog.append(noticeIcon, noticeTitle, noticeDescription, noticeClose);
  noticeOverlay.append(noticeDialog);
  document.body.append(noticeOverlay);

  function closeNotice() {
    noticeOverlay.hidden = true;
    noticeOverlay.style.display = "none";
    actionButton.focus();
  }

  function showNotice(title, description, fine) {
    noticeTitle.textContent = title;
    noticeDescription.textContent = description;
    if (fine) {
      const fineDetail = document.createElement("span");
      fineDetail.className = "mt-3 block font-semibold text-amber-700";
      fineDetail.textContent = `ค่าปรับ ฿${fine}`;
      noticeDescription.append(fineDetail);
    }
    noticeOverlay.hidden = false;
    noticeOverlay.style.display = "grid";
    noticeClose.focus();
  }

  noticeClose.addEventListener("click", closeNotice);
  noticeOverlay.addEventListener("click", event => {
    if (event.target === noticeOverlay) closeNotice();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !noticeOverlay.hidden) closeNotice();
  });

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
    if (member && loginLink.isConnected) {
      loginLink.remove();
    } else if (!member && !loginLink.isConnected) {
      actions.insertBefore(loginLink, overdueLabel);
    }
    actionButton.hidden = !member;
    actionButton.textContent = isBorrowed ? "คืนหนังสือ" : "ยืมหนังสือ";
    actionButton.classList.toggle("bg-red-600", isBorrowed);
    actionButton.classList.toggle("hover:bg-red-700", isBorrowed);
    actionButton.classList.toggle("bg-zinc-950", !isBorrowed);
    actionButton.classList.toggle("hover:bg-zinc-800", !isBorrowed);
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
      if (!result.ok) {
        message.textContent = "ไม่สามารถคืนหนังสือได้ กรุณาลองอีกครั้ง";
        render();
        return;
      }
      showNotice(
        "คืนหนังสือเรียบร้อย",
        result.fine ? "บันทึกการคืนหนังสือสำเร็จ" : "ขอบคุณที่นำหนังสือมาคืน",
        result.fine
      );
    } else {
      const result = window.LibrarySimulation.borrow(state, bookId, memberKey);
      if (!result.ok) {
        message.textContent = result.reason === "limitReached"
          ? "สมาชิกยืมครบตามโควตาแล้ว"
          : result.reason === "unavailable"
            ? "หนังสือถูกยืมหมดแล้ว"
            : "ไม่สามารถยืมหนังสือได้ กรุณาลองอีกครั้ง";
        render();
        return;
      }
      showNotice("ยืมหนังสือสำเร็จ", "กำหนดคืนหนังสือภายใน 14 วัน");
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

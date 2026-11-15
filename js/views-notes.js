'use strict';
/* Notes Studio view: composer, filters, and the note cards whose art is generated from
   the note's own text. See docs/js/notes.js for storage and pattern determinism. */

const noteView = {q: '', cat: '', editing: null};

function noteDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', {day: '2-digit', month: 'short'});
}

function noteCard(n) {
  const cat = Notes.categoryOf(n.category);
  const spec = Notes.specFor(n);
  return `<article class="note-card${n.pinned ? ' pinned' : ''}" data-note="${esc(n.id)}">
    <div class="note-art">
      <canvas data-art="${esc(n.id)}" aria-hidden="true"></canvas>
      ${n.pinned ? '<span class="note-pin" title="Pinned">★</span>' : ''}
    </div>
    <div class="note-body">
      <div class="note-title">${esc(n.title || 'Untitled note')}</div>
      <p class="note-text">${esc(n.text)}</p>
      <div class="note-foot">
        <span class="badge muted">${esc(cat.label)}</span>
        <span class="small muted">${esc(noteDate(n.updated || n.created))}</span>
        <span class="spacer"></span>
        <button class="note-act" data-act="preview" data-id="${esc(n.id)}"
          title="Show this note's pattern on the backdrop" aria-label="Preview pattern">✦</button>
        <button class="note-act" data-act="pin" data-id="${esc(n.id)}"
          title="${n.pinned ? 'Unpin' : 'Pin'}" aria-label="${n.pinned ? 'Unpin' : 'Pin'} note">${
    n.pinned ? 'Unpin' : 'Pin'}</button>
        <button class="note-act" data-act="edit" data-id="${esc(n.id)}">Edit</button>
        <button class="note-act danger" data-act="del" data-id="${esc(n.id)}">Delete</button>
      </div>
    </div>
  </article>`;
}

function noteMatches(n) {
  if (noteView.cat === 'pinned' && !n.pinned) return false;
  if (noteView.cat && noteView.cat !== 'pinned' && n.category !== noteView.cat) return false;
  const q = noteView.q.trim().toLowerCase();
  if (!q) return true;
  return (n.text + ' ' + (n.title || '') + ' ' + n.category).toLowerCase().includes(q);
}

function paintNoteArt(root = document) {
  $$('canvas[data-art]', root).forEach((c) => {
    const id = c.dataset.art;
    const note = Notes.load().find((n) => n.id === id);
    if (!note) return;
    Notes.paint(c, Notes.specFor(note));
  });
}

function noteListMarkup() {
  const all = Notes.sorted();
  const rows = all.filter(noteMatches);
  const chips = [{id: '', label: 'All', count: all.length},
    {id: 'pinned', label: 'Pinned', count: all.filter((n) => n.pinned).length}]
    .concat(Notes.CATEGORIES.map((c) => ({id: c.id, label: c.label,
      count: all.filter((n) => n.category === c.id).length})))
    .filter((c) => c.count || !c.id || c.id === 'pinned');
  if (!all.length) {
    return `<div class="empty"><b>No notes yet</b>Write your first note above — a promotion
      idea, a stock alert, a staff reminder. Each note gets its own generated pattern.</div>`;
  }
  if (!rows.length) {
    return `<div class="empty"><b>No notes match</b>Try another search or filter.</div>`;
  }
  return `<div class="note-grid">${rows.map(noteCard).join('')}</div>`;
}

function noteChipsMarkup() {
  const all = Notes.sorted();
  const chips = [{id: '', label: 'All', count: all.length},
    {id: 'pinned', label: 'Pinned', count: all.filter((n) => n.pinned).length}]
    .concat(Notes.CATEGORIES.map((c) => ({id: c.id, label: c.label,
      count: all.filter((n) => n.category === c.id).length})))
    .filter((c) => c.count > 0 || c.id === '');
  return chips.map((c) => `<button class="chip${noteView.cat === c.id ? ' active' : ''}"
    data-ncat="${c.id}">${esc(c.label)}${c.count ? ` <span class="chip-count">${c.count}</span>` : ''}
    </button>`).join('');
}

function refreshNotes(root) {
  const list = $('#noteList', root);
  if (!list) return;
  list.innerHTML = noteListMarkup();
  const chips = $('#noteChips', root);
  if (chips) chips.innerHTML = noteChipsMarkup();
  paintNoteArt(list);
  const count = $('#noteCount', root);
  if (count) count.textContent = Notes.load().length + ' saved';
}

function notesComposerMarkup() {
  const editing = noteView.editing;
  return `<div class="note-composer" id="noteComposer">
    <div class="nc-head">
      <div>
        <h3>${editing ? 'Edit note' : 'New note'}</h3>
        <div class="hint">${editing ? 'Changes repaint the pattern as soon as you save.'
    : 'Saved in this browser only. The pattern is generated from your text.'}</div>
      </div>
      ${editing ? '<button class="btn btn-ghost btn-sm" id="noteCancel">Cancel</button>' : ''}
    </div>
    <textarea id="noteText" rows="4" placeholder="Weekend sales promotion — 2-for-1 on sangria, Friday to Sunday, promote on Instagram.">${editing ? esc(editing.text) : ''}</textarea>
    <div class="nc-row">
      <label>Category
        <select id="noteCat">${Notes.CATEGORIES.map((c) => `<option value="${c.id}"
          ${(editing && editing.category === c.id) ? 'selected' : ''}>${esc(c.label)}</option>`)
    .join('')}</select>
      </label>
      <label>Pattern
        <select id="noteStyle">${Notes.STYLES.map((s) => `<option value="${s.id}"
          ${(editing && editing.style === s.id) ? 'selected' : ''}>${esc(s.label)}</option>`)
    .join('')}</select>
      </label>
      <label>Tone
        <select id="noteTone">${Object.keys(Notes.TONES).map((t) => `<option value="${t}"
          ${(editing && editing.tone === t) ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </label>
      <label class="nc-pin"><input type="checkbox" id="notePin"
        ${editing && editing.pinned ? 'checked' : ''}> Pin to top</label>
      <span class="spacer"></span>
      <button class="btn btn-gold" id="noteSave">${editing ? 'Save changes' : 'Add note'}</button>
    </div>
  </div>`;
}

function viewNotes(root) {
  root.innerHTML = `
  <section class="card notes-shell">
    ${notesComposerMarkup()}
    <div class="notes-toolbar">
      <div class="notes-search">
        ${svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>')}
        <input id="noteSearch" type="search" placeholder="Search notes…"
          aria-label="Search notes" value="${esc(noteView.q)}">
      </div>
      <div class="chips" id="noteChips">${noteChipsMarkup()}</div>
      <span class="small muted" id="noteCount">${Notes.load().length} saved</span>
    </div>
    <div id="noteList">${noteListMarkup()}</div>
  </section>
  <div class="notice" style="margin-top:14px">
    ${svg('<path d="M12 9v4M12 17h.01"/>' +
    '<path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>')}
    <span>Notes are personal working notes stored in this browser (localStorage
      <span class="mono">vv.notes</span>) — never uploaded, never mixed with the sales
      database. Patterns are decorative and derived from the note text by a local hash.</span>
  </div>`;

  paintNoteArt(root);

  const saveNote = () => {
    const text = $('#noteText', root).value.trim();
    if (!text) {
      toast('Write something in the note first', 'err');
      $('#noteText', root).focus();
      return;
    }
    const note = Notes.save({
      id: noteView.editing ? noteView.editing.id : undefined,
      text,
      category: $('#noteCat', root).value,
      style: $('#noteStyle', root).value,
      tone: $('#noteTone', root).value,
      pinned: $('#notePin', root).checked,
      created: noteView.editing ? noteView.editing.created : undefined,
    });
    noteView.editing = null;
    $('#noteComposer', root).outerHTML = notesComposerMarkup();
    bindComposer();
    refreshNotes(root);
    toast(note.pinned ? 'Note saved and pinned' : 'Note saved');
    Atmo.pulse();
  };

  function bindComposer() {
    $('#noteText', root).addEventListener('input', (e) => {
      const v = e.target.value.trim();
      if (v.length > 3) {
        const spec = Notes.specFor({text: v, category: $('#noteCat', root).value,
          style: $('#noteStyle', root).value, tone: $('#noteTone', root).value});
        Atmo.motif({kind: spec.kind, hue: spec.hue, seed: spec.seed, ms: 2600});
      }
    });
    $('#noteSave', root).addEventListener('click', saveNote);
    $('#noteText', root).addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); saveNote(); }
    });
    const cancel = $('#noteCancel', root);
    if (cancel) cancel.addEventListener('click', () => {
      noteView.editing = null;
      $('#noteComposer', root).outerHTML = notesComposerMarkup();
      bindComposer();
    });
  }
  bindComposer();

  $('#noteSearch', root).addEventListener('input', (e) => {
    noteView.q = e.target.value;
    refreshNotes(root);
  });
  $('#noteChips', root).addEventListener('click', (e) => {
    const b = e.target.closest('[data-ncat]');
    if (!b) return;
    noteView.cat = b.dataset.ncat;
    refreshNotes(root);
  });

  $('#noteList', root).addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const id = b.dataset.id;
    const note = Notes.load().find((n) => n.id === id);
    if (!note) return;
    if (b.dataset.act === 'preview') {
      const spec = Notes.specFor(note);
      Atmo.motif({kind: spec.kind, hue: spec.hue, seed: spec.seed, ms: 7000});
      Atmo.ripple(window.innerWidth / 2, window.innerHeight * 0.42,
        {hue: spec.hue, max: 260});
      toast('Pattern: ' + spec.kind);
    } else if (b.dataset.act === 'pin') {
      const n = Notes.togglePin(id);
      refreshNotes(root);
      toast(n && n.pinned ? 'Pinned' : 'Unpinned');
    } else if (b.dataset.act === 'edit') {
      noteView.editing = note;
      $('#noteComposer', root).outerHTML = notesComposerMarkup();
      bindComposer();
      $('#noteText', root).focus();
      $('#noteText', root).setSelectionRange(note.text.length, note.text.length);
      $('.notes-shell', root).scrollIntoView({behavior: 'smooth', block: 'start'});
    } else if (b.dataset.act === 'del') {
      openModal(`<button class="icon-btn modal-close" data-close aria-label="Close">✕</button>
        <h2>Delete this note?</h2>
        <div class="sub">“${esc(note.title || note.text.slice(0, 60))}”</div>
        <p class="small muted" style="margin-top:10px">This removes it from this browser.
          It cannot be undone.</p>
        <div class="row" style="margin-top:16px;gap:8px">
          <button class="btn" data-close>Keep note</button>
          <button class="btn btn-gold" id="noteDelYes">Delete note</button>
        </div>`, {label: 'Delete note'});
      $('#noteDelYes').addEventListener('click', () => {
        Notes.remove(id);
        closeModal();
        refreshNotes(root);
        toast('Note deleted');
      });
    }
  });
}

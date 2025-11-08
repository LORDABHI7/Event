// --- UI references ---
const loginBtn = document.getElementById('loginBtn');
const showSignup = document.getElementById('showSignup');
const showLogin = document.getElementById('showLogin');
const signupBtn = document.getElementById('signupBtn');
const authContainer = document.getElementById('authContainer');
const signupBox = document.getElementById('signupBox');
const eventSchedulerContainer = document.getElementById('eventSchedulerContainer');
const logoutBtn = document.getElementById('logoutBtn');

const addEventBtn = document.getElementById('addEventBtn');
const eventTitleInput = document.getElementById('eventTitle');
const eventDateInput = document.getElementById('eventDate');
const hourSelect = document.getElementById('hourSelect');
const minuteSelect = document.getElementById('minuteSelect');
const ampmSelect = document.getElementById('ampmSelect');
const eventsList = document.getElementById('events');
const requestNotifBtn = document.getElementById('requestNotif');

const toast = document.getElementById('toast');
const notifSound = document.getElementById('notifSound');

// --- Populate time picker ---
function fillTimePickers(){
  hourSelect.innerHTML = '';
  minuteSelect.innerHTML = '';
  for(let h=1; h<=12; h++){
    const opt = document.createElement('option');
    opt.value = String(h).padStart(2,'0');
    opt.textContent = String(h).padStart(2,'0');
    hourSelect.appendChild(opt);
  }
  for(let m=0; m<60; m+=1){
    const opt = document.createElement('option');
    opt.value = String(m).padStart(2,'0');
    opt.textContent = String(m).padStart(2,'0');
    minuteSelect.appendChild(opt);
  }
}
// set current time default
function setDefaultTime(){
  const now = new Date();
  let hour = now.getHours();
  const minute = now.getMinutes();
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12; if(hour === 0) hour = 12;
  hourSelect.value = String(hour).padStart(2,'0');
  minuteSelect.value = String(minute).padStart(2,'0');
  ampmSelect.value = ampm;
  // set date to today
  const iso = now.toISOString().slice(0,10);
  eventDateInput.value = iso;
}

fillTimePickers();
setDefaultTime();

// --- Basic auth simulation & UI toggles ---
document.getElementById('showSignup').addEventListener('click', (e)=>{
  e.preventDefault();
  authContainer.classList.add('hidden');
  signupBox.classList.remove('hidden');
});
document.getElementById('showLogin')?.addEventListener('click', (e)=>{
  e.preventDefault();
  signupBox.classList.add('hidden');
  authContainer.classList.remove('hidden');
});

loginBtn.addEventListener('click', ()=> {
  // fake login
  authContainer.classList.add('hidden');
  signupBox.classList.add('hidden');
  eventSchedulerContainer.classList.remove('hidden');
});
signupBtn?.addEventListener('click', ()=> {
  authContainer.classList.add('hidden');
  signupBox.classList.add('hidden');
  eventSchedulerContainer.classList.remove('hidden');
});
logoutBtn.addEventListener('click', ()=>{
  eventSchedulerContainer.classList.add('hidden');
  authContainer.classList.remove('hidden');
});

// --- event storage ---
let events = []; // {id, title, datetimeISO, notified:false}

// helper: convert custom pickers to ISO datetime string (local)
function makeEventISO(dateStr, hourStr, minuteStr, ampm){
  // dateStr is YYYY-MM-DD
  // hourStr 01-12, minuteStr 00-59
  let h = parseInt(hourStr,10);
  if(ampm === 'AM' && h === 12) h = 0;
  if(ampm === 'PM' && h !== 12) h += 12;
  const [y,mo,d] = dateStr.split('-').map(Number);
  const dt = new Date(y, mo-1, d, h, parseInt(minuteStr,10), 0, 0);
  return dt.toISOString();
}

// render events
function renderEvents(){
  eventsList.innerHTML = '';
  const sorted = [...events].sort((a,b)=> new Date(a.datetimeISO) - new Date(b.datetimeISO));
  sorted.forEach(ev=>{
    const li = document.createElement('li');
    li.className = 'event-item';
    const left = document.createElement('div');
    left.innerHTML = `<div class="title">${escapeHtml(ev.title)}</div>
                      <div class="meta">${formatLocal(ev.datetimeISO)}</div>`;
    const actions = document.createElement('div');
    actions.className = 'event-actions';
    const del = document.createElement('button');
    del.className = 'btn ghost';
    del.textContent = 'Delete';
    del.addEventListener('click', ()=>{
      events = events.filter(x=> x.id !== ev.id);
      renderEvents();
      showToast('Event deleted');
    });
    actions.appendChild(del);
    li.appendChild(left);
    li.appendChild(actions);
    eventsList.appendChild(li);
  });
}

// safe text
function escapeHtml(t){ return (t+'').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s])); }

// format ISO to local friendly string
function formatLocal(iso){
  const d = new Date(iso);
  return d.toLocaleString([], { dateStyle:'medium', timeStyle:'short' });
}

// small toast (in page)
let toastTimer = null;
function showToast(text, ms=2500){
  toast.textContent = text;
  toast.classList.remove('hidden');
  if(toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> toast.classList.add('hidden'), ms);
}

// --- Notifications (outside site) ---
async function requestNotificationPermission(){
  if(!('Notification' in window)){
    showToast('Notifications not supported in this browser');
    return false;
  }
  if(Notification.permission === 'granted') return true;
  try {
    const perm = await Notification.requestPermission();
    return perm === 'granted';
  } catch(e){
    return false;
  }
}

// triggers a desktop notification and plays sound
function triggerNotification(ev){
  // play sound
  try { notifSound.currentTime = 0; notifSound.play().catch(()=>{}); } catch(e){}

  // desktop notif
  if('Notification' in window && Notification.permission === 'granted'){
    const n = new Notification(ev.title, {
      body: `Starts now — ${formatLocal(ev.datetimeISO)}`,
      tag: ev.id,
      renotify: true
    });
    // clicking focuses the window
    n.onclick = () => { window.focus(); n.close(); };
  } else {
    // fallback in-page
    showToast(`⏰ ${ev.title} — it's time!`);
  }
}

// --- Scheduling check loop ---
function checkDueEvents(){
  const now = new Date();
  events.forEach(ev=>{
    if(ev.notified) return;
    const eventTime = new Date(ev.datetimeISO);
    // if current time >= event time (with second precision)
    if(now >= eventTime){
      ev.notified = true;
      triggerNotification(ev);
    }
  });
}
setInterval(checkDueEvents, 1000);

// add event
addEventBtn.addEventListener('click', async ()=>{
  const title = eventTitleInput.value.trim();
  const date = eventDateInput.value;
  const hour = hourSelect.value;
  const minute = minuteSelect.value;
  const ampm = ampmSelect.value;

  if(!title || !date || !hour || !minute || !ampm){
    showToast('Please fill all event details');
    return;
  }

  // if notifications are not granted, politely request
  if(Notification && Notification.permission !== 'granted'){
    // ask once
    const ok = await requestNotificationPermission();
    if(!ok){
      showToast('You can enable desktop notifications to get alerts outside the site');
    }
  }

  const iso = makeEventISO(date, hour, minute, ampm);
  const id = 'ev_'+Math.random().toString(36).slice(2,9);
  events.push({ id, title, datetimeISO: iso, notified:false });

  renderEvents();

  // small highlight
  showToast('Event added — we will notify you at the time');
  // clear title
  eventTitleInput.value = '';
  setDefaultTime();
});

// request notif button
requestNotifBtn.addEventListener('click', async ()=>{
  const ok = await requestNotificationPermission();
  showToast(ok ? 'Notifications enabled' : 'Notifications blocked');
});

// helper: set default time to now
function setDefaultTime(){
  const now = new Date();
  let hr = now.getHours();
  const min = now.getMinutes();
  const ampm = hr >= 12 ? 'PM' : 'AM';
  hr = hr % 12; if(hr === 0) hr = 12;
  hourSelect.value = String(hr).padStart(2,'0');
  minuteSelect.value = String(min).padStart(2,'0');
  ampmSelect.value = ampm;
  eventDateInput.value = now.toISOString().slice(0,10);
}
setDefaultTime();

// initialize sound: small beep fallback (if base64 audio invalid it will be silent)
try { notifSound.volume = 0.7; } catch(e){}

// Accessibility: Enter key adds when focused on title
eventTitleInput.addEventListener('keydown', (e)=>{
  if(e.key === 'Enter') addEventBtn.click();
});

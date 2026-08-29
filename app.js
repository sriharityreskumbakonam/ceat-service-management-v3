import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { getDatabase, ref, push, set, get } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getDatabase(firebaseApp);

const $ = id => document.getElementById(id);
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const money = v => "₹" + (Number(v)||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});
const today = () => new Date().toISOString().slice(0,10);

const serviceItems = [
  "Wheel Alignment","Wheel Balancing","Rotation","Tubes",
  "Tyre Fitment","Tubeless Tyre Repair","Nitrogen Gas","T/L Valve"
];

let records = [];
let currentPage = "dashboard";
let lastSavedRecord = null;

function showToast(title, message, callback){
  const t = $("toast");
  t.innerHTML = `<h3>✅ ${esc(title)}</h3><p>${message}</p><button id="toastOk">OK</button>`;
  t.hidden = false;
  $("toastOk").onclick = () => { t.hidden = true; if(callback) callback(); };
}

function nextRecordNo(){
  const nums = records.map(r => Number(r.recordNo)).filter(Number.isFinite);
  return String(Math.max(0,...nums)+1).padStart(3,"0");
}

async function loadRecords(){
  const snap = await get(ref(db,"serviceRecords"));
  records = [];
  if(snap.exists()){
    Object.entries(snap.val()).forEach(([key,value]) => records.push({...value,key}));
  }
}

function getLatestForVehicle(vehicleNumber){
  return records
    .filter(r => (r.vehicleNumber||"").toUpperCase() === (vehicleNumber||"").toUpperCase())
    .sort((a,b) => (b.date||"").localeCompare(a.date||"") || Number(b.currentKm||0)-Number(a.currentKm||0));
}

function reminderInfo(vehicleNumber){
  const list = getLatestForVehicle(vehicleNumber);
  if(!list.length) return {status:"NOT APPLICABLE",className:"neutral",text:""};
  const current = list[0];
  const free = list.find(r => r.classification === "Free Service");
  const regular = list.find(r => r.classification === "Regular Service");
  const currentKm = Number(current.currentKm)||0;

  const candidates = [];
  if(free){
    const targetKm = Number(free.currentKm||0)+2000;
    const d = new Date((free.date||today())+"T00:00:00");
    d.setMonth(d.getMonth()+1);
    const dateText = d.toLocaleDateString("en-IN",{day:"2-digit",month:"2-digit",year:"numeric"});
    const due = currentKm >= targetKm || new Date() >= d;
    candidates.push({due,targetKm,dateText,label:`Free: ${targetKm.toLocaleString("en-IN")} KM / ${dateText}`});
  }
  if(regular){
    const targetKm = Number(regular.currentKm||0)+5000;
    const due = currentKm >= targetKm;
    candidates.push({due,targetKm,label:`Regular: ${targetKm.toLocaleString("en-IN")} KM`});
  }
  if(!candidates.length) return {status:"NOT APPLICABLE",className:"neutral",text:"No service baseline"};
  const due = candidates.find(x=>x.due);
  if(due) return {status:"DUE",className:"due",text:due.label};
  return {status:"NOT DUE",className:"ok",text:candidates.map(x=>x.label).join(" • ")};
}

function dashboard(){
  const uniqueVehicles = new Set(records.map(r=>r.vehicleNumber).filter(Boolean)).size;
  const due = [...new Set(records.map(r=>r.vehicleNumber).filter(Boolean))].filter(v=>reminderInfo(v).status==="DUE").length;
  const todayCount = records.filter(r=>r.date===today()).length;
  return `
  <div class="page-head"><h1>Dashboard</h1><div class="page-actions"><button class="btn primary" data-go="record">+ New Service Record</button></div></div>
  <div class="stats">
    <div class="stat"><small>Vehicles</small><b>${uniqueVehicles}</b></div>
    <div class="stat"><small>Service Records</small><b>${records.length}</b></div>
    <div class="stat"><small>Due Reminders</small><b>${due}</b></div>
    <div class="stat"><small>Today's Records</small><b>${todayCount}</b></div>
  </div>
  <section class="card" style="margin-top:15px"><h2>Recent Service Records</h2>${recordsTable(records.slice().sort((a,b)=>(b.date||"").localeCompare(a.date||"")).slice(0,10))}</section>`;
}

function vehicles(){
  const map = {};
  records.forEach(r => { if(r.vehicleNumber) map[r.vehicleNumber.toUpperCase()] = r; });
  const rows = Object.values(map).sort((a,b)=>(a.vehicleNumber||"").localeCompare(b.vehicleNumber||"")).map(r=>{
    const ri = reminderInfo(r.vehicleNumber);
    return `<tr>
      <td><b>${esc(r.vehicleNumber)}</b></td>
      <td>${esc(r.customerName||"—")}<br><span class="muted">${esc(r.mobile||"")}</span></td>
      <td>${esc(r.vehicleModel)}</td>
      <td>${Number(r.currentKm||0).toLocaleString("en-IN")} KM</td>
      <td>${esc(r.date)}</td>
      <td><span class="badge ${ri.className}">${ri.status}</span><br><small>${esc(ri.text)}</small></td>
      <td>${r.mobile?`<button class="btn" data-wa="${esc(r.mobile)}" data-vno="${esc(r.vehicleNumber)}" data-name="${esc(r.customerName)}">WhatsApp</button>`:"—"}</td>
    </tr>`;
  }).join("");
  return `<div class="page-head"><h1>Vehicles</h1><button class="btn primary" data-go="record">+ New Service Record</button></div>
  <section class="card"><div class="searchbar"><input id="vehicleSearch" placeholder="Search vehicle number, model, customer or mobile"></div>
  <div id="vehicleTable" class="table-wrap">${rows?`<table class="data-table"><thead><tr><th>Vehicle</th><th>Customer</th><th>Model</th><th>Current KM</th><th>Last Record</th><th>Reminder</th><th>WhatsApp</th></tr></thead><tbody>${rows}</tbody></table>`:`<div class="empty">No service records yet.</div>`}</div></section>`;
}

function serviceRecord(){
  const no = nextRecordNo();
  return `<div class="page-head"><h1>New Service Record</h1></div>
  <section class="card">
    <h2>Customer & Vehicle Details</h2>
    <div class="grid2">
      <div class="field"><label>Service Record No.</label><input id="recordNo" value="${no}" readonly></div>
      <div class="field"><label>Date</label><input id="recordDate" type="date" value="${today()}"></div>
      <div class="field"><label>Customer Name <span class="optional">(Optional)</span></label><input id="customerName" type="text" placeholder="Enter customer name"></div>
      <div class="field"><label>Mobile Number <span class="optional">(Optional)</span></label><input id="mobile" type="tel" inputmode="numeric" placeholder="Enter 10-digit mobile number"></div>
      <div class="field"><label>Vehicle Model <span class="required">*</span></label><input id="vehicleModel" type="text" placeholder="Enter vehicle model"></div>
      <div class="field"><label>Vehicle Number <span class="required">*</span></label><input id="vehicleNumber" type="text" placeholder="Enter vehicle registration number"></div>
      <div class="field"><label>Current KM <span class="required">*</span></label><input id="currentKm" type="number" min="0" inputmode="numeric" placeholder="Enter current KM"></div>
      <div class="field"><label>Service Classification</label><select id="classification"><option value="">Select classification</option><option value="Free Service">Free Service</option><option value="Regular Service">Regular Service</option><option value="Not Applicable">Not Applicable</option></select></div>
    </div>
  </section>
  <section class="card">
    <h2>Services / Charges</h2>
    <div class="service-scroll"><div class="service-table">
      <div class="service-row service-head"><div>Service / Item</div><div>Qty</div><div>Rate (₹)</div><div>Amount (₹)</div></div>
      ${serviceItems.map((name,i)=>`<div class="service-row"><div>${name}</div><div><input class="qty" data-i="${i}" type="number" min="0" value="${i===0?1:0}"></div><div><input class="rate" data-i="${i}" type="number" min="0" value="0"></div><div id="amount${i}" class="amount">₹0.00</div></div>`).join("")}
    </div></div>
    <div class="totals">
      <div class="total-line"><span>Subtotal</span><b id="subtotal">₹0.00</b></div>
      <div class="total-line"><span>Discount</span><input id="discount" type="number" min="0" value="0"></div>
      <div class="total-line grand"><span>Grand Total</span><b id="grandTotal">₹0.00</b></div>
    </div>
  </section>
  <div class="actions"><button id="clearRecord" class="btn">Clear</button><button id="printRecord" class="btn" disabled>Print Service Record</button><button id="saveRecord" class="btn primary">Save Service Record</button></div>`;
}

function readForm(){
  const services = serviceItems.map((name,i)=>{
    const qty = Number(document.querySelector(`.qty[data-i="${i}"]`)?.value)||0;
    const rate = Number(document.querySelector(`.rate[data-i="${i}"]`)?.value)||0;
    return {name,qty,rate,amount:qty*rate};
  });
  const subtotal = services.reduce((a,x)=>a+x.amount,0);
  const discount = Number($("discount")?.value)||0;
  return {
    recordNo:$("recordNo")?.value||"",
    date:$("recordDate")?.value||today(),
    customerName:$("customerName")?.value.trim()||"",
    mobile:$("mobile")?.value.trim()||"",
    vehicleModel:$("vehicleModel")?.value.trim()||"",
    vehicleNumber:($("vehicleNumber")?.value.trim()||"").toUpperCase(),
    currentKm:Number($("currentKm")?.value)||0,
    classification:$("classification")?.value||"",
    services,subtotal,discount,total:Math.max(0,subtotal-discount)
  };
}

function calculate(){
  if(!$("recordNo")) return;
  const f=readForm();
  f.services.forEach((x,i)=>{const a=$("amount"+i);if(a)a.textContent=money(x.amount)});
  $("subtotal").textContent=money(f.subtotal);
  $("grandTotal").textContent=money(f.total);
}

function validMobile(m){
  const digits=(m||"").replace(/\D/g,"");
  return digits.length===10?digits:"";
}

function whatsappNumber(m){
  const digits=(m||"").replace(/\D/g,"");
  return digits.length===10?"91"+digits:digits;
}

function openWhatsApp(mobile,message){
  const n=whatsappNumber(mobile);
  if(!n) return;
  window.open(`https://wa.me/${n}?text=${encodeURIComponent(message)}`,"_blank");
}

function serviceRecordMessage(r){
  return `Dear ${r.customerName||"Customer"},

Greetings from Sri Hari Tyres.

Your service record has been successfully created.

Service Record No: ${r.recordNo}
Vehicle Model: ${r.vehicleModel}
Vehicle Number: ${r.vehicleNumber}
Current KM: ${Number(r.currentKm).toLocaleString("en-IN")} KM
Service Classification: ${r.classification}
Total: ${money(r.total)}

Thank you for choosing Sri Hari Tyres.
We look forward to serving you again.

Sri Hari Tyres
50-1, Venkatesha nagar,
Ullur,
Kumbakonam - 612001
6382212457`;
}

async function saveRecord(){
  const f=readForm();
  if(!f.vehicleModel||!f.vehicleNumber||!f.currentKm){
    alert("Vehicle Model, Vehicle Number and Current KM are required.");
    return;
  }
  if(!f.classification){
    alert("Please select Service Classification.");
    return;
  }
  const mobile=validMobile(f.mobile);
  if(f.mobile && !mobile){
    alert("Please enter a valid 10-digit mobile number, or leave it blank.");
    return;
  }
  const btn=$("saveRecord");
  btn.disabled=true;btn.textContent="Saving...";
  try{
    const newRef=push(ref(db,"serviceRecords"));
    const saved={...f,mobile,savedAt:new Date().toISOString(),firebaseKey:newRef.key};
    await set(newRef,saved);
    await loadRecords();
    lastSavedRecord=saved;
    $("printRecord").disabled=false;
    showToast("Service Record Saved",`Service Record No: <b>${esc(f.recordNo)}</b><br>Vehicle: <b>${esc(f.vehicleNumber)}</b>`);
    if(mobile){
      setTimeout(()=>openWhatsApp(mobile,serviceRecordMessage(saved)),500);
    }
  }catch(error){
    console.error(error);
    alert("Service Record could not be saved. Please check Firebase Authentication and Realtime Database rules.");
  }finally{
    btn.disabled=false;btn.textContent="Save Service Record";
  }
}

function recordsTable(list){
  if(!list.length)return `<div class="empty">No service records found.</div>`;
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>No.</th><th>Date</th><th>Vehicle</th><th>Customer</th><th>KM</th><th>Classification</th><th>Total</th></tr></thead><tbody>
  ${list.map(r=>`<tr><td>${esc(r.recordNo)}</td><td>${esc(r.date)}</td><td><b>${esc(r.vehicleNumber)}</b><br>${esc(r.vehicleModel)}</td><td>${esc(r.customerName||"—")}<br><span class="muted">${esc(r.mobile||"")}</span></td><td>${Number(r.currentKm||0).toLocaleString("en-IN")}</td><td>${esc(r.classification)}</td><td>${money(r.total)}</td></tr>`).join("")}
  </tbody></table></div>`;
}

function history(){
  return `<div class="page-head"><h1>Service History</h1></div><section class="card"><div class="searchbar"><input id="historySearch" placeholder="Search vehicle, customer, mobile or record number"></div><div id="historyTable">${recordsTable(records.slice().sort((a,b)=>(b.date||"").localeCompare(a.date||"")))}</div></section>`;
}

function reminders(){
  const vehicleMap={};
  records.forEach(r=>{if(r.vehicleNumber)vehicleMap[r.vehicleNumber.toUpperCase()]=r});
  const rows=Object.values(vehicleMap).map(r=>{
    const ri=reminderInfo(r.vehicleNumber);
    return `<tr><td><b>${esc(r.vehicleNumber)}</b><br>${esc(r.vehicleModel)}</td><td>${esc(r.customerName||"—")}<br>${esc(r.mobile||"")}</td><td>${Number(r.currentKm||0).toLocaleString("en-IN")} KM</td><td>${esc(r.classification)}</td><td><span class="badge ${ri.className}">${ri.status}</span></td><td>${esc(ri.text)}</td><td>${r.mobile?`<button class="btn" data-reminder-wa="${esc(r.mobile)}" data-vno="${esc(r.vehicleNumber)}" data-model="${esc(r.vehicleModel)}" data-name="${esc(r.customerName)}">WhatsApp</button>`:"—"}</td></tr>`;
  }).join("");
  return `<div class="page-head"><h1>Reminders</h1></div>
  <section class="card"><p class="muted"><b>Free Service:</b> Last Free Service KM + 2,000 KM OR 1 month, whichever comes first.<br><b>Regular Service:</b> Last Regular Service KM + 5,000 KM only.</p>
  <div class="table-wrap">${rows?`<table class="data-table"><thead><tr><th>Vehicle</th><th>Customer</th><th>Current KM</th><th>Last Classification</th><th>Status</th><th>Next Service</th><th>WhatsApp</th></tr></thead><tbody>${rows}</tbody></table>`:`<div class="empty">No reminder records yet.</div>`}</div></section>`;
}

function reports(){
  const total=records.reduce((a,r)=>a+Number(r.total||0),0);
  const free=records.filter(r=>r.classification==="Free Service").length;
  const regular=records.filter(r=>r.classification==="Regular Service").length;
  return `<div class="page-head"><h1>Reports</h1></div><div class="stats">
    <div class="stat"><small>Total Service Records</small><b>${records.length}</b></div>
    <div class="stat"><small>Total Service Value</small><b>${money(total)}</b></div>
    <div class="stat"><small>Free Service Records</small><b>${free}</b></div>
    <div class="stat"><small>Regular Service Records</small><b>${regular}</b></div>
  </div><section class="card" style="margin-top:15px"><h2>Service Summary</h2>${recordsTable(records.slice().sort((a,b)=>(b.date||"").localeCompare(a.date||"")))}</section>`;
}

function whatsappPage(){
  return `<div class="page-head"><h1>WhatsApp</h1></div><section class="card">
  <h2>Customer Communication</h2>
  <p class="muted">After a Service Record is successfully saved, if a valid customer mobile number is entered, WhatsApp opens automatically with a pre-filled service-record message. You only need to review and tap <b>Send</b> in WhatsApp.</p>
  <p class="muted">Payment receipts are <b>not</b> sent through WhatsApp.</p></section>`;
}

function render(){
  document.querySelectorAll(".nav").forEach(n=>n.classList.toggle("active",n.dataset.page===currentPage));
  const pages={dashboard,vehicles,record:serviceRecord,history,reminders,reports,whatsapp:whatsappPage};
  $("mainContent").innerHTML=pages[currentPage]();
  bindPage();
  if(currentPage==="record")calculate();
}

function bindPage(){
  document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>{currentPage=b.dataset.go;render()});
  if(currentPage==="record"){
    document.querySelectorAll(".qty,.rate,#discount").forEach(x=>x.oninput=calculate);
    $("clearRecord").onclick=()=>render();
    $("saveRecord").onclick=saveRecord;
    $("printRecord").onclick=()=>{if(lastSavedRecord)printRecord(lastSavedRecord)};
  }
  $("historySearch")?.addEventListener("input",e=>{
    const q=e.target.value.toLowerCase();
    $("historyTable").innerHTML=recordsTable(records.filter(r=>JSON.stringify(r).toLowerCase().includes(q)));
  });
  $("vehicleSearch")?.addEventListener("input",e=>{
    const q=e.target.value.toLowerCase();
    document.querySelectorAll("#vehicleTable tbody tr").forEach(tr=>tr.style.display=tr.innerText.toLowerCase().includes(q)?"":"none");
  });
  document.querySelectorAll("[data-wa]").forEach(b=>b.onclick=()=>{
    openWhatsApp(b.dataset.wa,`Dear ${b.dataset.name||"Customer"},

Greetings from Sri Hari Tyres.

Thank you for choosing us for your vehicle service.

Vehicle Number: ${b.dataset.vno}

For appointments or assistance, please contact us.

Sri Hari Tyres
50-1, Venkatesha nagar,
Ullur,
Kumbakonam - 612001
6382212457`);
  });
  document.querySelectorAll("[data-reminder-wa]").forEach(b=>b.onclick=()=>{
    openWhatsApp(b.dataset.reminderWa,`Dear ${b.dataset.name||"Customer"},

Greetings from Sri Hari Tyres.

This is a friendly reminder for your ${b.dataset.model} (${b.dataset.vno}).

Your vehicle is due for its scheduled service. Please contact us to plan your visit at your convenience.

Thank you for choosing Sri Hari Tyres.

Sri Hari Tyres
50-1, Venkatesha nagar,
Ullur,
Kumbakonam - 612001
6382212457`);
  });
}

function printRecord(r){
  const rows=r.services.filter(x=>x.qty>0||x.amount>0).map((x,i)=>`<tr><td>${String(i+1).padStart(2,"0")}</td><td><b>${esc(x.name)}</b></td><td>${x.qty}</td><td>${Number(x.rate).toFixed(2)}</td><td>${Number(x.amount).toFixed(2)}</td></tr>`).join("");
  $("printArea").innerHTML=`<div class="print-sheet">
    <div class="print-head">
      <div><h1>SRI HARI TYRES</h1><div class="print-sub">AUTHORISED CEAT TYRES &amp; SERVICE CENTRE</div><div class="print-address">50-1, Venkatesha nagar,<br>Ullur,<br>Kumbakonam - 612001<br><b>6382212457</b></div></div>
      <div><div class="print-tag">SERVICE RECORD</div><div class="print-meta">Service Record No. : <b>#${esc(r.recordNo)}</b><br>Date : <b>${esc(r.date)}</b></div></div>
    </div>
    <div class="print-boxes">
      <div class="print-box"><h3>CUSTOMER INFORMATION</h3><div class="kv"><span>Customer Name :</span><b>${esc(r.customerName||"—")}</b><span>Contact No. :</span><b>${esc(r.mobile||"—")}</b></div></div>
      <div class="print-box"><h3>VEHICLE &amp; SERVICE DETAILS</h3><div class="kv"><span>Vehicle Model :</span><b>${esc(r.vehicleModel)}</b><span>Vehicle Reg. No. :</span><b>${esc(r.vehicleNumber)}</b><span>Odometer Reading :</span><b>${Number(r.currentKm).toLocaleString("en-IN")} KM</b></div></div>
    </div>
    <table class="print-table"><thead><tr><th>S.NO</th><th>SERVICE / ITEM DESCRIPTION</th><th>QTY</th><th>RATE (₹)</th><th>AMOUNT (₹)</th></tr></thead><tbody>${rows||`<tr><td colspan="5" style="text-align:center">No service items entered</td></tr>`}</tbody></table>
    <div class="print-lower">
      <div class="terms"><h3>TERMS &amp; CONDITIONS</h3><ol><li>This document is a service record.</li><li>All services are performed using calibrated &amp; computerized equipment.</li></ol></div>
      <div class="print-totals"><div class="pline"><span>Subtotal</span><b>${money(r.subtotal)}</b></div><div class="pline"><span>Discount</span><b>${money(r.discount)}</b></div><div class="pline pgrand"><span>GRAND TOTAL</span><b>${money(r.total)}</b></div></div>
    </div>
    <div class="print-sign"><div>For SRI HARI TYRES<br>(Authorized Signatory)</div></div>
    <div class="print-footer"><b>Thank You!</b> &nbsp; Thank you for choosing <b>Sri Hari Tyres!</b> &nbsp; Drive Safe &amp; Have a Great Journey.</div>
  </div>`;
  window.print();
}

document.querySelectorAll(".nav").forEach(n=>n.onclick=()=>{currentPage=n.dataset.page;render()});

$("loginButton").onclick=async()=>{
  $("loginError").textContent="";
  try{await signInWithEmailAndPassword(auth,$("loginEmail").value.trim(),$("loginPassword").value);}
  catch(e){console.error(e);$("loginError").textContent="Login failed. Please check User ID and password.";}
};
$("loginPassword").addEventListener("keydown",e=>{if(e.key==="Enter")$("loginButton").click()});
$("logoutButton").onclick=()=>signOut(auth);

onAuthStateChanged(auth,async user=>{
  if(user){
    $("loginScreen").hidden=true;$("appShell").hidden=false;
    try{await loadRecords();render()}catch(e){console.error(e);alert("Connected to login, but database could not be read. Check Realtime Database rules.");}
  }else{
    $("appShell").hidden=true;$("loginScreen").hidden=false;
  }
});

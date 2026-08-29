import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getDatabase, ref, push, set, onValue } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const recordsRef = ref(db,"serviceRecords");

const SERVICES=["Wheel Alignment","Wheel Balancing","Rotation","Tubes","Tyre Fitment","Tubeless Tyre Repair","Nitrogen Gas","T/L Valve"];
const state={records:[],page:"dashboard",savedRecord:null,editingRecord:null};

const $=s=>document.querySelector(s);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=n=>"₹"+(Number(n)||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;};
const prettyDate=d=>d?new Date(d+"T00:00:00").toLocaleDateString("en-IN",{day:"2-digit",month:"2-digit",year:"numeric"}):"—";
const normalizePhone=p=>String(p||"").replace(/\D/g,"").replace(/^0/,"").replace(/^91(?=\d{10}$)/,"");
const recordNo=()=>{const nums=state.records.map(r=>parseInt(r.recordNo,10)).filter(Number.isFinite);return String((nums.length?Math.max(...nums):0)+1).padStart(3,"0")};

onValue(recordsRef,snap=>{
  const v=snap.val()||{};
  state.records=Object.entries(v).map(([id,r])=>({id,...r})).sort((a,b)=>new Date(b.savedAt||0)-new Date(a.savedAt||0));
  if(state.page==="dashboard"||state.page==="history"||state.page==="reminders"||state.page==="reports"||state.page==="vehicles") render();
});

function toast(msg){const t=$("#toast");t.textContent=msg;t.style.display="block";clearTimeout(window._toast);window._toast=setTimeout(()=>t.style.display="none",2600)}
function setPage(p){state.page=p;document.querySelectorAll(".nav").forEach(b=>b.classList.toggle("active",b.dataset.page===p));render()}
document.querySelectorAll(".nav").forEach(b=>b.onclick=()=>setPage(b.dataset.page));
$("#logoutBtn").onclick=()=>toast("Logout is not required in this standalone version.");

function serviceRowsHTML(){
 return SERVICES.map((n,i)=>`<div class="service-row">
 <div><b>${n}</b></div>
 <input class="qty" data-i="${i}" type="number" min="0" step="1" value="0">
 <input class="rate" data-i="${i}" type="number" min="0" step="0.01" value="0">
 <div class="amt" id="amt-${i}">₹0.00</div>
 </div>`).join("");
}
function serviceFormHTML(){
 const e=state.editingRecord;
 const val=(k,d="")=>esc(e && e[k]!==undefined ? e[k] : d);
 const sel=v=>e && e.classification===v ? " selected" : "";
 const rowData={}; (e?.services||[]).forEach(x=>rowData[x.name]=x);
 const rows=SERVICES.map((n,i)=>{const x=rowData[n]||{};return `<div class="service-row">
 <div><b>${n}</b></div>
 <input class="qty" data-i="${i}" type="number" min="0" step="1" value="${Number(x.qty||0)}">
 <input class="rate" data-i="${i}" type="number" min="0" step="0.01" value="${Number(x.rate||0)}">
 <div class="amt" id="amt-${i}">${money(Number(x.amount||0))}</div>
 </div>`}).join("");
 return `<div class="page-head"><h1>${e?"Edit Service Record":"New Service Record"}</h1></div>
 <section class="card"><h2>Customer &amp; Vehicle Details</h2>
 <div class="grid2">
  <div><label>Service Record No.</label><input id="recordNo" value="${val("recordNo",recordNo())}" readonly></div>
  <div><label>Date</label><input id="recordDate" type="date" value="${val("date",today())}"></div>
  <div><label>Customer Name <span class="opt">(Optional)</span></label><input id="customerName" value="${val("customerName")}" placeholder="Enter customer name"></div>
  <div><label>Mobile Number <span class="opt">(Optional)</span></label><input id="mobile" inputmode="numeric" value="${val("mobile")}" placeholder="10-digit mobile number"></div>
  <div><label>Vehicle Model <span class="req">*</span></label><input id="vehicleModel" value="${val("vehicleModel")}" placeholder="Eg. Tata Nexon"></div>
  <div><label>Vehicle Number <span class="req">*</span></label><input id="vehicleNumber" value="${val("vehicleNumber")}" placeholder="Eg. TN49AB1234"></div>
  <div><label>Current KM Reading <span class="req">*</span></label><input id="currentKm" type="number" min="0" value="${e?Number(e.currentKm||0):""}" placeholder="Enter current KM"></div>
  <div><label>Service Classification <span class="req">*</span></label><select id="classification"><option value="">Select classification</option><option${sel("Free Service")}>Free Service</option><option${sel("Regular Service")}>Regular Service</option><option${sel("Not Applicable")}>Not Applicable</option></select></div>
 </div>
 <p class="hint">Customer name and mobile are optional. Vehicle model, vehicle number and current KM are required.</p>
 </section>
 <section class="card"><h2>Services / Charges</h2>
 <div class="service-table"><div class="service-head"><div>SERVICE / ITEM</div><div>QTY</div><div>RATE (₹)</div><div>AMOUNT (₹)</div></div><div id="serviceRows">${rows}</div></div>
 <div class="totals"><div class="total-line"><span>Subtotal</span><b id="subtotal">${money(e?.subtotal||0)}</b></div>
 <div class="total-line"><span>Discount</span><input id="discount" type="number" min="0" step="0.01" value="${Number(e?.discount||0)}"></div>
 <div class="total-line grand"><span>Grand Total</span><b id="grandTotal">${money(e?.total||0)}</b></div></div>
 </section>
 <section class="card"><h2>Reminder Rules</h2><div class="rule-grid">
 <div class="rule"><strong>FREE SERVICE</strong><span>Last Free Service + 2,000 KM OR 1 month, whichever comes first.</span></div>
 <div class="rule"><strong>REGULAR SERVICE</strong><span>Last Regular Service + 5,000 KM only.</span></div>
 </div>
 <div class="notice" style="margin-top:12px">A service record updates the relevant reminder baseline only when it is saved with the matching service classification.</div>
 </section>
 <div class="bottom-actions"><button class="btn" id="clearBtn">${e?"Cancel Edit":"Clear"}</button><button class="btn blue" id="printBtn" ${e?"":"disabled"}>Print Service Record</button><button class="btn green" id="shareBtn" ${e && navigator.share?"":"disabled"}>Share PDF via WhatsApp</button><button class="btn primary" id="saveBtn">${e?"Update Service Record":"Save Service Record"}</button></div>`;
}
function getForm(){
 const services=SERVICES.map((name,i)=>{const qty=Number($(`.qty[data-i="${i}"]`)?.value)||0;const rate=Number($(`.rate[data-i="${i}"]`)?.value)||0;return {name,qty,rate,amount:qty*rate}}).filter(x=>x.qty>0||x.rate>0);
 const subtotal=services.reduce((a,x)=>a+x.amount,0),discount=Math.max(0,Number($("#discount")?.value)||0);
 return {recordNo:$("#recordNo")?.value,date:$("#recordDate")?.value,customerName:$("#customerName")?.value.trim(),mobile:$("#mobile")?.value.trim(),vehicleModel:$("#vehicleModel")?.value.trim(),vehicleNumber:$("#vehicleNumber")?.value.trim().toUpperCase(),currentKm:Number($("#currentKm")?.value)||0,classification:$("#classification")?.value,services,subtotal,discount,total:Math.max(0,subtotal-discount)};
}
function calc(){if(!$("#serviceRows"))return;const f=getForm();SERVICES.forEach((_,i)=>{const x=f.services.find(s=>s.name===SERVICES[i]);$(`#amt-${i}`).textContent=money(x?.amount||0)});$("#subtotal").textContent=money(f.subtotal);$("#grandTotal").textContent=money(f.total)}
function bindService(){
 document.querySelectorAll("#main input, #main select").forEach(el=>el.addEventListener("input",calc));
 document.querySelectorAll("#main select").forEach(el=>el.addEventListener("change",calc));
 $("#clearBtn").onclick=()=>{state.editingRecord=null;state.savedRecord=null;renderService();};
 $("#saveBtn").onclick=saveRecord;
 $("#printBtn").onclick=()=>state.savedRecord&&openPrint(state.savedRecord);
 $("#shareBtn").onclick=()=>state.savedRecord&&sharePDF(state.savedRecord);
 if(state.editingRecord) state.savedRecord={...state.editingRecord};
 calc();
}
let saveInProgress=false;
function previousRegularForVehicle(vehicleNumber, excludeId=null){
 return state.records.filter(r=>r.vehicleNumber===vehicleNumber && r.classification==="Regular Service" && r.id!==excludeId)
   .sort((a,b)=>new Date(b.savedAt||b.date||0)-new Date(a.savedAt||a.date||0))[0]||null;
}
function previousFreeForVehicle(vehicleNumber, excludeId=null){
 return state.records.filter(r=>r.vehicleNumber===vehicleNumber && r.classification==="Free Service" && r.id!==excludeId)
   .sort((a,b)=>new Date(b.savedAt||b.date||0)-new Date(a.savedAt||a.date||0))[0]||null;
}
function buildServiceWhatsApp(f){
 const name=f.customerName||"Customer";
 if(f.classification==="Not Applicable") return null;
 if(f.classification==="Regular Service"){
   const freeKm=Number(f.currentKm||0)+2000;
   const paidKm=Number(f.currentKm||0)+5000;
   return `Dear ${name},\n\nYour regular alignment service for ${f.vehicleNumber} has been completed at ${Number(f.currentKm).toLocaleString("en-IN")} KM at Sri Hari Tyres.\n\nFree service: ${freeKm.toLocaleString("en-IN")} KM or within 1 month, whichever comes first.\nNext paid regular service: ${paidKm.toLocaleString("en-IN")} KM.\n\nThank you for trusting Sri Hari Tyres.`;
 }
 const previousRegular=previousRegularForVehicle(f.vehicleNumber,state.editingRecord?.id);
 const paidKm=previousRegular?Number(previousRegular.currentKm||0)+5000:Number(f.currentKm||0)+5000;
 return `Dear ${name},\n\nYour free service for ${f.vehicleNumber} has been completed at ${Number(f.currentKm).toLocaleString("en-IN")} KM at Sri Hari Tyres.\n\nYour next paid regular service is due at ${paidKm.toLocaleString("en-IN")} KM.\nPlease visit Sri Hari Tyres for your regular alignment service.\n\nThank you for trusting Sri Hari Tyres.`;
}
function openWhatsAppMessage(f){
 const phone=normalizePhone(f.mobile);
 const text=buildServiceWhatsApp(f);
 if(!phone || !text) return;
 const url=`https://wa.me/91${phone}?text=${encodeURIComponent(text)}`;
 try{ window.open(url,"_blank"); }catch(e){ location.href=url; }
}
async function saveRecord(){
 if(saveInProgress)return;
 const f=getForm();
 f.classification=String(f.classification||"").trim();
 if(!f.vehicleModel||!f.vehicleNumber||!f.currentKm){alert("Please enter Vehicle Model, Vehicle Number and Current KM.");return}
 if(!f.classification){alert("Please select Service Classification.");return}
 if(f.mobile && !/^\d{10}$/.test(normalizePhone(f.mobile))){alert("Please enter a valid 10-digit mobile number.");return}
 if(!f.services.length){alert("Please enter at least one service or charge.");return}
 const btn=$("#saveBtn");
 saveInProgress=true; btn.disabled=true; btn.textContent=state.editingRecord?"Updating...":"Saving...";
 try{
   let id,data,isUpdate=false;
   if(state.editingRecord){
     isUpdate=true; id=state.editingRecord.id;
     data={...state.editingRecord,...f,updatedAt:new Date().toISOString()};
   }else{
     const r=push(recordsRef); id=r.key;
     data={...f,savedAt:new Date().toISOString(),firebaseKey:r.key};
   }
   const target=ref(db,`serviceRecords/${id}`);
   const timeout=new Promise((_,reject)=>setTimeout(()=>reject(new Error("SAVE_TIMEOUT")),15000));
   await Promise.race([set(target,data),timeout]);
   state.savedRecord={id,...data};
   state.editingRecord=null;
   $("#printBtn").disabled=false;
   $("#shareBtn").disabled=!(navigator.share && f.mobile);
   showSaved(f.recordNo,isUpdate);
   if(!isUpdate) openWhatsAppMessage(f);
 }catch(e){
   console.error("Service record save failed:",e);
   if(e && e.message==="SAVE_TIMEOUT") alert("Save is taking too long. Please check your internet connection and try again. No success message was received from Firebase.");
   else alert("Could not save the service record. Firebase error: " + (e?.message || "Unknown error"));
 }finally{
   saveInProgress=false;
   btn.disabled=false;
   btn.textContent=state.editingRecord?"Update Service Record":"Save Service Record";
 }
}
function showSaved(no){
 const box=$("#saveStatus");box.innerHTML=`<div class="save-box"><div class="save-icon">✅</div><h3>Service Record Saved</h3><p>Service Record No: <b>#${esc(no)}</b><br>Saved successfully to the live database.</p><button id="savedOk">OK</button></div>`;box.style.display="flex";$("#savedOk").onclick=()=>box.style.display="none";
}
function printHTML(f){
 const rows=(f.services.length?f.services:[{name:"—",qty:"",rate:0,amount:0}]).map((x,i)=>`<tr><td>${i+1}</td><td><b>${esc(x.name)}</b></td><td>${x.qty}</td><td>${Number(x.rate).toFixed(2)}</td><td>${Number(x.amount).toFixed(2)}</td></tr>`).join("");
 return `<!doctype html><html><head><title>Service Record #${esc(f.recordNo)}</title><style>
 *{box-sizing:border-box}body{margin:0;background:#fff;font-family:Arial,sans-serif;color:#172235}.sheet{width:760px;margin:0 auto;padding:26px 30px}
 .top{display:flex;justify-content:space-between;border-bottom:3px solid #0879c9;padding-bottom:10px}.brand{font-size:30px;font-weight:900;color:#06447b}.sub{font-size:11px;color:#0879c9;font-weight:900;letter-spacing:1px;margin-top:4px}.addr{font-size:10px;line-height:1.55;color:#5e6c7c;margin-top:7px}.tag{background:#ffd21a;padding:10px 13px;font-weight:900;font-size:14px}.meta{font-size:10px;text-align:right;margin-top:7px;color:#5e6c7c}
 .boxes{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:17px}.box{border:1px solid #ccd9e3;border-radius:7px;padding:12px;background:#f6fbff}.box h3{font-size:9px;letter-spacing:1px;color:#6b7b8b;margin:0 0 9px;border-bottom:1px solid #d8e3eb;padding-bottom:6px}.kv{display:grid;grid-template-columns:115px 1fr;gap:6px;font-size:10px}.kv span{color:#667586}.kv b{color:#172235}
 table{width:100%;border-collapse:collapse;margin-top:17px;font-size:10px}th{background:#071827;color:#fff;padding:9px;text-align:left}td{padding:10px 8px;border-bottom:1px solid #dde5eb}th:nth-child(n+3),td:nth-child(n+3){text-align:right}td:first-child,th:first-child{text-align:center}
 .lower{display:grid;grid-template-columns:1fr 250px;gap:18px;margin-top:15px}.terms h3{font-size:10px;margin:0 0 7px}.terms p{font-size:9px;color:#657587;line-height:1.55}.tot{border:1px solid #d5e0e8}.line{display:flex;justify-content:space-between;padding:9px 10px;font-size:10px;color:#657587}.grand{background:#071827;color:#fff;font-size:14px;font-weight:900}
 .sign{display:flex;justify-content:flex-end;margin-top:52px;font-size:9px;font-weight:900}.sign div{width:220px;text-align:center;border-top:1px dashed #9eacb8;padding-top:7px}.footer{margin-top:20px;text-align:center;font-size:10px;font-weight:900;color:#0879c9;background:#e9f7ff;border:1px solid #bfe4f7;padding:10px}
 @media print{.sheet{width:100%;padding:12mm}body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body><div class="sheet">
 <div class="top"><div><div class="brand">SRI HARI TYRES</div><div class="sub">AUTHORISED CEAT TYRES &amp; SERVICE CENTRE</div><div class="addr">50-1, Venkatesha Nagar,<br>Ullur,<br>Kumbakonam - 612001<br>6382212457</div></div><div><div class="tag">SERVICE RECORD</div><div class="meta">Service Record No: <b>#${esc(f.recordNo)}</b><br>Date: <b>${esc(f.date)}</b></div></div></div>
 <div class="boxes"><div class="box"><h3>CUSTOMER INFORMATION</h3><div class="kv"><span>Customer Name:</span><b>${esc(f.customerName||"—")}</b><span>Mobile No.:</span><b>${esc(f.mobile||"—")}</b></div></div><div class="box"><h3>VEHICLE &amp; SERVICE DETAILS</h3><div class="kv"><span>Vehicle Model:</span><b>${esc(f.vehicleModel)}</b><span>Vehicle Reg. No.:</span><b>${esc(f.vehicleNumber)}</b><span>Current KM:</span><b>${Number(f.currentKm).toLocaleString("en-IN")} KM</b></div></div></div>
 <table><thead><tr><th>S.NO</th><th>SERVICE / ITEM DESCRIPTION</th><th>QTY</th><th>RATE (₹)</th><th>AMOUNT (₹)</th></tr></thead><tbody>${rows}</tbody></table>
 <div class="lower"><div class="terms"><h3>TERMS &amp; CONDITIONS</h3><p>1. This document is a service record.<br>2. All services are performed using calibrated and computerized equipment where applicable.</p></div><div class="tot"><div class="line"><span>Subtotal</span><b>₹${f.subtotal.toFixed(2)}</b></div><div class="line"><span>Discount</span><b>₹${f.discount.toFixed(2)}</b></div><div class="line grand"><span>Grand Total</span><b>₹${f.total.toFixed(2)}</b></div></div></div>
 <div class="sign"><div>For SRI HARI TYRES<br>(Authorized Signatory)</div></div>
 <div class="footer">Thank you for trusting Sri Hari Tyres.</div></div><script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></body></html>`;
}
function openPrint(f){
  const html=printHTML(f);
  let w=null;
  try{ w=window.open("","_blank","width=900,height=1200"); }catch(e){}
  if(w){
    w.document.open(); w.document.write(html); w.document.close();
    setTimeout(()=>{try{w.focus();w.print();}catch(e){}},500);
    return;
  }
  let host=document.getElementById("printHost");
  if(!host){host=document.createElement("div");host.id="printHost";document.body.appendChild(host);}
  const doc=new DOMParser().parseFromString(html,"text/html");
  const sheet=doc.querySelector(".sheet");
  if(!sheet){alert("Could not prepare the service record for printing.");return;}
  host.innerHTML=""; host.appendChild(document.importNode(sheet,true)); host.dataset.active="1";
  setTimeout(()=>window.print(),120);
}
window.addEventListener("afterprint",()=>{
  const host=document.getElementById("printHost");
  if(host){host.innerHTML="";host.dataset.active="0";}
});
async function makePDF(f){
 const jsPDF=window.jspdf?.jsPDF;if(!jsPDF)throw new Error("PDF library unavailable");
 const doc=new jsPDF({unit:"mm",format:"a4"});
 doc.setFillColor(7,24,39);doc.rect(0,0,210,13,"F");doc.setTextColor(255,255,255);doc.setFontSize(15);doc.setFont(undefined,"bold");doc.text("SRI HARI TYRES",12,9);
 doc.setTextColor(8,121,201);doc.setFontSize(10);doc.text("AUTHORISED CEAT TYRES & SERVICE CENTRE",12,20);
 doc.setTextColor(80,95,110);doc.setFontSize(8);doc.setFont(undefined,"normal");doc.text(["50-1, Venkatesha Nagar,","Ullur,","Kumbakonam - 612001","6382212457"],12,26);
 doc.setFillColor(255,210,26);doc.rect(159,16,39,9,"F");doc.setTextColor(20,30,40);doc.setFontSize(9);doc.setFont(undefined,"bold");doc.text("SERVICE RECORD",163,22);
 doc.setFont(undefined,"normal");doc.setFontSize(8);doc.text(`Record No: #${f.recordNo}`,159,30);doc.text(`Date: ${f.date}`,159,35);
 let y=43;doc.setDrawColor(210,220,228);doc.setFillColor(246,251,255);doc.roundedRect(12,y,90,27,2,2,"FD");doc.roundedRect(108,y,90,27,2,2,"FD");
 doc.setTextColor(100,115,130);doc.setFontSize(7);doc.text("CUSTOMER INFORMATION",16,y+6);doc.text("VEHICLE & SERVICE DETAILS",112,y+6);
 doc.setTextColor(25,34,48);doc.setFontSize(8);doc.text(`Customer Name: ${f.customerName||"—"}`,16,y+13);doc.text(`Mobile No.: ${f.mobile||"—"}`,16,y+19);
 doc.text(`Vehicle Model: ${f.vehicleModel}`,112,y+13);doc.text(`Vehicle Reg. No.: ${f.vehicleNumber}`,112,y+19);doc.text(`Current KM: ${Number(f.currentKm).toLocaleString("en-IN")} KM`,112,y+25);
 y=78;doc.setFillColor(7,24,39);doc.rect(12,y,186,9,"F");doc.setTextColor(255,255,255);doc.setFontSize(7);doc.text("S.NO",15,y+6);doc.text("SERVICE / ITEM DESCRIPTION",28,y+6);doc.text("QTY",142,y+6);doc.text("RATE",158,y+6);doc.text("AMOUNT",179,y+6);
 doc.setTextColor(25,34,48);let n=0;for(const x of f.services){n++;y+=9;doc.line(12,y+2,198,y+2);doc.text(String(n),15,y);doc.text(x.name,28,y);doc.text(String(x.qty),143,y);doc.text(Number(x.rate).toFixed(2),158,y);doc.text(Number(x.amount).toFixed(2),180,y)}
 y+=12;doc.setTextColor(90,105,120);doc.setFontSize(8);doc.text("TERMS & CONDITIONS",12,y);doc.text("This document is a service record.",12,y+6);doc.text("All services are performed using calibrated and computerized equipment where applicable.",12,y+12);
 const tx=145;doc.setDrawColor(210,220,228);doc.rect(tx,y-4,53,29);doc.setTextColor(90,105,120);doc.text("Subtotal",tx+4,y+2);doc.text(money(f.subtotal),tx+37,y+2,{align:"right"});doc.text("Discount",tx+4,y+9);doc.text(money(f.discount),tx+37,y+9,{align:"right"});doc.setFillColor(7,24,39);doc.rect(tx,y+14,53,11,"F");doc.setTextColor(255,255,255);doc.setFont(undefined,"bold");doc.text("Grand Total",tx+4,y+21);doc.text(money(f.total),tx+49,y+21,{align:"right"});
 doc.setTextColor(8,121,201);doc.setFontSize(9);doc.text("For SRI HARI TYRES (Authorized Signatory)",198,272,{align:"right"});doc.setFillColor(233,247,255);doc.rect(12,278,186,11,"F");doc.text("Thank you for trusting Sri Hari Tyres.",105,285,{align:"center"});
 return doc.output("blob");
}
async function sharePDF(f){
 try{
  const blob=await makePDF(f),file=new File([blob],`Sri-Hari-Tyres-Service-Record-${f.recordNo}.pdf`,{type:"application/pdf"});
  const phone=normalizePhone(f.mobile);
  const msg=`Dear ${f.customerName||"Customer"},%0AThank you for visiting Sri Hari Tyres.%0AService Record #${f.recordNo} for ${f.vehicleNumber} is attached.%0AThank you for trusting Sri Hari Tyres.`;
  if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({title:`Sri Hari Tyres Service Record #${f.recordNo}`,text:`Dear ${f.customerName||"Customer"},\nThank you for visiting Sri Hari Tyres.\nService Record #${f.recordNo} for ${f.vehicleNumber} is attached.\nThank you for trusting Sri Hari Tyres.`,files:[file]});}
  else{window.open(`https://wa.me/${phone?phone:""}?text=${msg}`,"_blank");alert("Your phone/browser does not support direct PDF attachment. The WhatsApp message is opened; attach the generated PDF from your Downloads/Share sheet.");}
 }catch(e){console.error(e);alert("PDF sharing was cancelled or is not supported on this device. Use Print Service Record to save/print the PDF.")}
}
function renderService(){ $("#main").innerHTML=serviceFormHTML();bindService() }

function startOfWeek(){
 const d=new Date(); const day=d.getDay(); const diff=day===0?6:day-1;
 d.setDate(d.getDate()-diff); return d.toISOString().slice(0,10);
}
function firstOfMonth(){
 const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`;
}
function dateFiltered(arr,from,to){
 const f=from||"0000-01-01",t=to||"9999-12-31";
 return arr.filter(r=>(r.date||"")>=f&&(r.date||"")<=t);
}
function filterBar(prefix){
 return `<div class="filterbar">
 <div><label>From Date</label><input id="${prefix}From" type="date" value="${today()}"></div>
 <div><label>To Date</label><input id="${prefix}To" type="date" value="${today()}"></div>
 <div class="filter-actions"><button class="btn blue" id="${prefix}Apply">Apply</button><button class="btn" id="${prefix}Clear">Clear</button></div>
 </div>
 <div class="quick-filters"><button data-qfilter="${prefix}:today">Today</button><button data-qfilter="${prefix}:week">This Week</button><button data-qfilter="${prefix}:month">This Month</button><button data-qfilter="${prefix}:all">All Records</button></div>`;
}
function bindDateFilter(prefix,callback){
 $(`#${prefix}Apply`).onclick=()=>callback($(`#${prefix}From`).value,$(`#${prefix}To`).value);
 $(`#${prefix}Clear`).onclick=()=>{ $(`#${prefix}From`).value=today();$(`#${prefix}To`).value=today();callback(today(),today()) };
 document.querySelectorAll(`[data-qfilter^="${prefix}:"]`).forEach(b=>b.onclick=()=>{
   const mode=b.dataset.qfilter.split(":")[1]; let f=today(),t=today();
   if(mode==="week")f=startOfWeek();
   if(mode==="month")f=firstOfMonth();
   if(mode==="all"){f="0000-01-01";t="9999-12-31"}
   $(`#${prefix}From`).value=f;$(`#${prefix}To`).value=t;callback(f,t);
 });
}
function downloadExcelBackup(sourceRecords=state.records){
 if(!sourceRecords.length){alert("There are no service records in the selected period.");return}
 if(!window.XLSX){alert("Excel backup is unavailable. Please check your internet connection and try again.");return}
 const rows=sourceRecords.map(r=>{const o={"Service Record No.":r.recordNo||"","Date":r.date||"","Customer Name":r.customerName||"","Mobile Number":r.mobile||"","Vehicle Model":r.vehicleModel||"","Vehicle Number":r.vehicleNumber||"","Current KM":Number(r.currentKm||0),"Service Classification":r.classification||""};(r.services||[]).forEach(x=>{o[`${x.name} Qty`]=Number(x.qty||0);o[`${x.name} Rate`]=Number(x.rate||0);o[`${x.name} Amount`]=Number(x.amount||0)});o["Subtotal"]=Number(r.subtotal||0);o["Discount"]=Number(r.discount||0);o["Grand Total"]=Number(r.total||0);o["Saved Date & Time"]=r.savedAt||"";return o;});
 const wb=XLSX.utils.book_new(),ws=XLSX.utils.json_to_sheet(rows);XLSX.utils.book_append_sheet(wb,ws,"Service Records");
 const info=XLSX.utils.aoa_to_sheet([["SRI HARI TYRES — CEAT SERVICE MANAGEMENT"],["Backup Date & Time",new Date().toLocaleString("en-IN")],["Records Exported",sourceRecords.length],["Address","50-1, Venkatesha Nagar, Ullur, Kumbakonam - 612001"],["Phone","6382212457"]]);XLSX.utils.book_append_sheet(wb,info,"Backup Info");
 const d=new Date(),stamp=`${String(d.getDate()).padStart(2,"0")}-${String(d.getMonth()+1).padStart(2,"0")}-${d.getFullYear()}`;XLSX.writeFile(wb,`SriHari_Service_Backup_${stamp}.xlsx`);
}
function renderDashboard(){
 const total=state.records.length,todayCount=state.records.filter(r=>r.date===today()).length,free=state.records.filter(r=>r.classification==="Free Service").length,regular=state.records.filter(r=>r.classification==="Regular Service").length,uniqueVehicles=new Set(state.records.map(r=>r.vehicleNumber).filter(Boolean)).size;
 $("#main").innerHTML=`<div class="hero"><h1>Dashboard</h1><div>Live Service Management for Sri Hari Tyres</div></div>
 <div class="stat-grid"><div class="stat"><div class="label">UNIQUE VEHICLES</div><div class="num">${uniqueVehicles}</div></div><div class="stat"><div class="label">SERVICE RECORDS</div><div class="num">${total}</div></div><div class="stat"><div class="label">TODAY'S RECORDS</div><div class="num">${todayCount}</div></div><div class="stat"><div class="label">REMINDER BASELINES</div><div class="num">${free+regular}</div></div></div>
 <section class="card" style="margin-top:16px"><h2>Recent Service Records</h2>${state.records.length?`<div class="table-wrap"><table><thead><tr><th>Record</th><th>Date</th><th>Customer</th><th>Vehicle</th><th>Classification</th><th class="num">Total</th></tr></thead><tbody>${state.records.slice(0,8).map(r=>`<tr><td>#${esc(r.recordNo)}</td><td>${prettyDate(r.date)}</td><td>${esc(r.customerName||"—")}</td><td><b>${esc(r.vehicleNumber)}</b><br>${esc(r.vehicleModel)}</td><td>${esc(r.classification)}</td><td class="num">${money(r.total)}</td></tr>`).join("")}</tbody></table></div>`:'<div class="empty">No service records found.</div>'}</section>`;
}
function renderVehicles(){
 const latest={};
 state.records.forEach(r=>{if(r.vehicleNumber&&!latest[r.vehicleNumber])latest[r.vehicleNumber]=r});
 const allVehicles=Object.values(latest);
 const models=[...new Set(allVehicles.map(r=>r.vehicleModel).filter(Boolean))].sort();
 const classifications=["All Services","Free Service","Regular Service","Not Applicable"];
 const render=()=>{
   const q=($(`#vehicleSearch`)?.value||"").toLowerCase().trim();
   const model=$(`#vehicleModelFilter`)?.value||"";
   const cls=$(`#vehicleClassFilter`)?.value||"All Services";
   let arr=allVehicles.filter(r=>{
     const hay=[r.vehicleNumber,r.customerName,r.mobile,r.vehicleModel].join(" ").toLowerCase();
     const history=state.records.filter(x=>x.vehicleNumber===r.vehicleNumber);
     return (!q||hay.includes(q)) && (!model||r.vehicleModel===model) && (cls==="All Services"||history.some(x=>x.classification===cls));
   });
   $("#vehicleCount").textContent=`${arr.length} current vehicle(s)`;
   $("#vehicleList").innerHTML=vehicleRows(arr);
 };
 $("#main").innerHTML=`<div class="page-head"><h1>Vehicles</h1><button class="btn primary" id="newVehicleRecord">+ Service Record</button></div>
 <section class="card">
   <div class="filterbar vehicle-filterbar">
    <div><label>Search</label><input id="vehicleSearch" placeholder="Vehicle, customer, mobile or model"></div>
    <div><label>Vehicle Model</label><select id="vehicleModelFilter"><option value="">All Models</option>${models.map(m=>`<option value="${esc(m)}">${esc(m)}</option>`).join("")}</select></div>
    <div><label>Service Type</label><select id="vehicleClassFilter">${classifications.map(c=>`<option>${esc(c)}</option>`).join("")}</select></div>
    <div class="filter-actions"><button class="btn" id="vehicleReset">Clear</button></div>
   </div>
   <div class="result-bar"><b id="vehicleCount">${allVehicles.length} current vehicle(s)</b><span>Showing latest record for each vehicle</span></div>
   <div id="vehicleList">${vehicleRows(allVehicles)}</div>
 </section>`;
 $("#newVehicleRecord").onclick=()=>setPage("service");
 ["vehicleSearch","vehicleModelFilter","vehicleClassFilter"].forEach(id=>$("#"+id).oninput=render);
 $("#vehicleReset").onclick=()=>{$("#vehicleSearch").value="";$("#vehicleModelFilter").value="";$("#vehicleClassFilter").value="All Services";render()};
}
function vehicleRows(arr){
 if(!arr.length)return '<div class="empty">No vehicles found.</div>';
 return `<div>${arr.map(r=>{
   const history=state.records.filter(x=>x.vehicleNumber===r.vehicleNumber).sort((a,b)=>(b.date||"").localeCompare(a.date||""));
   const hid="vh_"+r.id.replace(/[^A-Za-z0-9]/g,"_");
   return `<div class="vehicle-card"><div class="vehicle-head"><div><h3>${esc(r.vehicleNumber)}</h3><small>${esc(r.vehicleModel)} • ${history.length} record(s)</small></div><button class="btn" data-toggle-history="${hid}">View History</button></div>
   <div class="vehicle-details"><div class="detail-chip"><span>Customer</span><b>${esc(r.customerName||"—")}</b></div><div class="detail-chip"><span>Mobile</span><b>${esc(r.mobile||"—")}</b></div><div class="detail-chip"><span>Last Service</span><b>${prettyDate(r.date)}</b></div><div class="detail-chip"><span>Current KM</span><b>${Number(r.currentKm||0).toLocaleString("en-IN")} KM</b></div></div>
   <div id="${hid}" class="history-expand" hidden>${historyRows(history)}</div></div>`;
 }).join("")}</div>`;
}
document.addEventListener("click",e=>{
 const editButton=e.target.closest("[data-edit]");
 if(editButton){
   const r=state.records.find(x=>x.id===editButton.dataset.edit);
   if(r){state.editingRecord={...r};state.savedRecord={...r};setPage("service");}
   return;
 }
 const printButton=e.target.closest("[data-print]");
 if(printButton){
   const r=state.records.find(x=>x.id===printButton.dataset.print);
   if(r) openPrint(r);
   return;
 }
 const b=e.target.closest("[data-toggle-history]");
 if(b){const el=$("#"+b.dataset.toggleHistory);if(el){el.hidden=!el.hidden;b.textContent=el.hidden?"View History":"Hide History";}}
});

function renderHistory(){
 $("#main").innerHTML=`<div class="page-head"><h1>Service History</h1><div class="actions"><button class="btn green" id="historyExcel">⬇ Excel</button></div></div>
 <section class="card">${filterBar("history")}
 <div class="searchbar"><input id="historySearch" placeholder="Search vehicle, customer, mobile, model or record no."></div>
 <div id="historyResult"></div></section>`;
 let filtered=dateFiltered(state.records,today(),today());
 const paint=()=>{
   const q=($("#historySearch")?.value||"").toLowerCase().trim();
   const arr=filtered.filter(r=>[r.recordNo,r.vehicleNumber,r.customerName,r.mobile,r.vehicleModel].join(" ").toLowerCase().includes(q));
   const dates=arr.map(r=>r.date).filter(Boolean).sort();
   $("#historyResult").innerHTML=`<div class="result-bar"><span><b>${arr.length}</b> record(s)</span><span>${dates.length?prettyDate(dates[0])+" → "+prettyDate(dates[dates.length-1]):""}</span></div>${historyRows(arr)}`;
 };
 bindDateFilter("history",(f,t)=>{
   if(f&&t&&f>t){alert("From Date cannot be after To Date.");return}
   filtered=dateFiltered(state.records,f,t);paint();
 });
 $("#historySearch").oninput=paint;paint();
 $("#historyExcel").onclick=()=>downloadExcelBackup(filtered);
}

function historyRows(arr){
 if(!arr.length)return '<div class="empty">No service records found.</div>';
 return `<div class="table-wrap"><table><thead><tr><th>Record</th><th>Date</th><th>Customer / Mobile</th><th>Vehicle</th><th>Service</th><th class="num">Total</th><th>Actions</th></tr></thead><tbody>${arr.map(r=>`<tr>
 <td>#${esc(r.recordNo)}</td><td>${prettyDate(r.date)}</td><td>${esc(r.customerName||"—")}<br>${esc(r.mobile||"—")}</td>
 <td><b>${esc(r.vehicleNumber)}</b><br>${esc(r.vehicleModel)}<br>${Number(r.currentKm).toLocaleString("en-IN")} KM</td>
 <td>${esc(r.classification)}<br>${(r.services||[]).map(x=>esc(x.name)).join(", ")||"—"}</td>
 <td class="num">${money(r.total)}</td><td><button class="btn" data-edit="${r.id}">Edit</button> <button class="btn" data-print="${r.id}">Print</button></td></tr>`).join("")}</tbody></table></div>`;
}

function daysBetween(a,b){return Math.round((new Date(b+"T00:00:00")-new Date(a+"T00:00:00"))/86400000)}
function reminderForVehicle(vehicleRecords){
 const classified=vehicleRecords.filter(r=>r.classification!=="Not Applicable").sort((a,b)=>new Date(b.savedAt||b.date||0)-new Date(a.savedAt||a.date||0));
 const latest=classified[0]; if(!latest)return null;
 if(latest.classification==="Regular Service"){
   const dueDate=addDays(latest.date,18);
   return {vehicleNumber:latest.vehicleNumber,customerName:latest.customerName,mobile:latest.mobile,type:"Free Service",baseline:latest,currentKm:Number(latest.currentKm||0),dueKm:Number(latest.currentKm||0)+2000,dueDate,rule:"Free service becomes eligible on the 18th day after regular service."};
 }
 if(latest.classification==="Free Service"){
   const regular=vehicleRecords.filter(r=>r.classification==="Regular Service" && new Date(r.savedAt||r.date||0)<new Date(latest.savedAt||latest.date||0)).sort((a,b)=>new Date(b.savedAt||b.date||0)-new Date(a.savedAt||a.date||0))[0];
   const paidKm=regular?Number(regular.currentKm||0)+5000:Number(latest.currentKm||0)+5000;
   const dueDate=addDays(latest.date,45);
   return {vehicleNumber:latest.vehicleNumber,customerName:latest.customerName,mobile:latest.mobile,type:"Regular Service",baseline:latest,currentKm:Number(latest.currentKm||0),dueKm:paidKm,dueDate,rule:"Please visit Sri Hari Tyres after 45 days for regular alignment service."};
 }
 return null;
}
function addDays(dateStr,n){const d=new Date(dateStr+"T00:00:00");d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)}
function renderReminders(){
 const byVehicle={};
 state.records.forEach(r=>{if(r.vehicleNumber)(byVehicle[r.vehicleNumber]??=[]).push(r)});
 let all=Object.values(byVehicle).map(reminderForVehicle).filter(Boolean);
 const render=()=>{
   const q=($(`#reminderSearch`)?.value||"").toLowerCase().trim();
   const status=$(`#reminderStatus`)?.value||"All";
   const type=$(`#reminderType`)?.value||"All";
   const todayStr=today();
   const arr=all.filter(x=>{
     const due=x.dueDate<=todayStr;
     const upcoming=!due;
     const hay=[x.vehicleNumber,x.customerName,x.mobile,x.type].join(" ").toLowerCase();
     return (!q||hay.includes(q)) && (type==="All"||x.type===type) && (status==="All"||(status==="Due Now"&&due)||(status==="Upcoming"&&upcoming));
   }).sort((a,b)=>a.dueDate.localeCompare(b.dueDate));
   $("#reminderResult").innerHTML=`<div class="result-bar"><b>${arr.length} reminder(s)</b><span>Regular → Free after 18 days • Free → Regular after 45 days</span></div>${arr.map(reminderCard).join("")||'<div class="empty">No reminders match the selected filters.</div>'}`;
 };
 $("#main").innerHTML=`<div class="page-head"><h1>Service Reminders</h1></div><section class="card">
 <div class="notice">If this service has already been completed, please kindly disregard this reminder. We appreciate your continued trust in Sri Hari Tyres.</div>
 <div class="filterbar reminder-filterbar">
  <div><label>Search</label><input id="reminderSearch" placeholder="Vehicle, customer or mobile"></div>
  <div><label>Status</label><select id="reminderStatus"><option>All</option><option>Due Now</option><option>Upcoming</option></select></div>
  <div><label>Service</label><select id="reminderType"><option>All</option><option>Free Service</option><option>Regular Service</option></select></div>
  <div class="filter-actions"><button class="btn" id="reminderClear">Clear</button></div>
 </div>
 <div id="reminderResult"></div></section>`;
 ["reminderSearch","reminderStatus","reminderType"].forEach(id=>$("#"+id).oninput=render);
 $("#reminderClear").onclick=()=>{$("#reminderSearch").value="";$("#reminderStatus").value="All";$("#reminderType").value="All";render()};
 render();
}
function reminderCard(x){
 const due=x.dueDate<=today();
 const days=Math.max(0,daysBetween(today(),x.dueDate));
 const text=x.type==="Free Service"?
 `Dear ${x.customerName||"Customer"},\n\nYour free service for ${x.vehicleNumber} is now due. Please visit Sri Hari Tyres for your free service.\n\nIf this service has already been completed, please kindly disregard this reminder.\n\nThank you for trusting Sri Hari Tyres.`:
 `Dear ${x.customerName||"Customer"},\n\nPlease visit Sri Hari Tyres for your regular alignment service. Your paid service reference is ${Number(x.dueKm).toLocaleString("en-IN")} KM, based on your previous regular service.\n\nIf this service has already been completed, please kindly disregard this reminder.\n\nThank you for trusting Sri Hari Tyres.`;
 return `<div class="reminder"><div><h3>${esc(x.vehicleNumber)} — ${esc(x.customerName||"Customer")}</h3><small>${esc(x.type)} • Due: ${prettyDate(x.dueDate)} • ${due?"Due now":`${days} day(s) remaining`} • KM reference: ${Number(x.dueKm).toLocaleString("en-IN")} KM</small><br><small>${esc(x.rule)}</small></div><div><span class="badge ${due?"due":"ok"}">${due?"SERVICE DUE":"UPCOMING"}</span> ${x.mobile?`<button class="btn green" onclick='sendReminder(${JSON.stringify(normalizePhone(x.mobile))},${JSON.stringify(text)})'>WhatsApp</button>`:""}</div></div>`;
}
window.sendReminder=(phone,text)=>window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`,"_blank");

function renderReports(){
 $("#main").innerHTML=`<div class="page-head"><h1>Reports</h1></div>
 <section class="card">${filterBar("report")}<div id="reportContent"></div></section>`;
 const paint=(f=today(),t=today())=>{
   const arr=dateFiltered(state.records,f,t);
   const total=arr.reduce((a,r)=>a+Number(r.total||0),0);
   const free=arr.filter(r=>r.classification==="Free Service").length;
   const regular=arr.filter(r=>r.classification==="Regular Service").length;
   $("#reportContent").innerHTML=`<div class="stat-grid">
    <div class="stat"><div class="label">RECORDS</div><div class="num">${arr.length}</div></div>
    <div class="stat"><div class="label">SERVICE VALUE</div><div class="num">${money(total)}</div></div>
    <div class="stat"><div class="label">FREE SERVICE</div><div class="num">${free}</div></div>
    <div class="stat"><div class="label">REGULAR SERVICE</div><div class="num">${regular}</div></div>
   </div>
   <div class="actions" style="margin-top:15px"><button class="btn green" id="reportExcel">⬇ Excel Backup</button></div>
   <div style="margin-top:14px">${arr.length?historyRows(arr):'<div class="empty">No records in the selected period.</div>'}</div>`;
   $("#reportExcel").onclick=()=>downloadExcelBackup(arr);
 };
 bindDateFilter("report",(f,t)=>{
   if(f&&t&&f>t){alert("From Date cannot be after To Date.");return}
   paint(f,t);
 });
 paint();
}

function render(){
 if(state.page==="service")renderService();
 else if(state.page==="dashboard")renderDashboard();
 else if(state.page==="vehicles")renderVehicles();
 else if(state.page==="history")renderHistory();
 else if(state.page==="reminders")renderReminders();
 else renderReports();
}
render();

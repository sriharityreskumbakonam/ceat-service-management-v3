const firebaseConfig={apiKey:"AIzaSyCKWITST9Xl-RyS-K8WMHcgZ9xxyKfBmlo",authDomain:"ceat-service-management.firebaseapp.com",databaseURL:"https://ceat-service-management-default-rtdb.asia-southeast1.firebasedatabase.app",projectId:"ceat-service-management",storageBucket:"ceat-service-management.firebasestorage.app",messagingSenderId:"498531760991",appId:"1:498531760991:web:11818a77a9185ce316d4ea"};
let db=null, recordsRef=null, remindersRef=null, recordCounterRef=null;
let fbReady=false;
const SHOP={name:"SRI HARI TYRES",sub:"AUTHORISED CEAT TYRES & SERVICE CENTRE",address:["50-1, Venkatesha Nagar,","Thiruvidaimaruthur Main Road,","Ullur, Kumbakonam - 612001"],phone:"6382212457"};
const SERVICES=["Wheel Alignment","Wheel Balancing","Rotation","Tubes","Tyre Fitment","Tubeless Tyre Repair","Nitrogen Gas","T/L Valve"];
const TECHNICIANS=["ARIVAZHAGAN","ARAVIND","ARJUN","SARATH KUMAR","VIJAY"];
const state={records:[],reminders:[],page:"dashboard",editingRecord:null,savedRecord:null};
const $=s=>document.querySelector(s), esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
const money=n=>"₹"+(Number(n)||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`};
const prettyDate=d=>d?new Date(d+"T00:00:00").toLocaleDateString("en-IN",{day:"2-digit",month:"2-digit",year:"numeric"}):"—";
const normalizePhone=p=>String(p||"").replace(/\D/g,"").replace(/^0/,"").replace(/^91(?=\d{10}$)/,"");
function prefixValue(p){let n=0;for(const c of String(p||"")){n=n*26+(c.charCodeAt(0)-64)}return n}
function prefixFromValue(n){let s="";while(n>0){n--;s=String.fromCharCode(65+(n%26))+s;n=Math.floor(n/26)}return s}
function recordKey(v){const x=String(v||"").trim().toUpperCase();const m=x.match(/^(\d+)$/);if(m){const n=Number(m[1]);return {stage:0,prefix:0,num:n}}const a=x.match(/^([A-Z]+)(\d+)$/);if(a)return {stage:1,prefix:prefixValue(a[1]),num:Number(a[2])};return null}
function compareRecordKeys(a,b){return a.stage-b.stage||a.prefix-b.prefix||a.num-b.num}
function nextRecordFromMax(max){const k=recordKey(max);if(!k)return "1";if(k.stage===0){if(k.num<9999)return String(k.num+1);return "A1"}if(k.num<9999)return prefixFromValue(k.prefix)+String(k.num+1);return prefixFromValue(k.prefix+1)+"1"}
const recordNo=()=>{let max=null,maxKey=null;for(const r of state.records){const k=recordKey(r.recordNo);if(k&&(!maxKey||compareRecordKeys(k,maxKey)>0)){max=r.recordNo;maxKey=k}}return nextRecordFromMax(max)};
const addDays=(s,n)=>{const d=new Date(s+"T00:00:00");d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)};
const addMonths=(s,n)=>{const d=new Date(s+"T00:00:00"),day=d.getDate();d.setMonth(d.getMonth()+n);if(d.getDate()<day)d.setDate(0);return d.toISOString().slice(0,10)};
const dateFiltered=(arr,f,t)=>arr.filter(r=>(r.date||"")>=(f||"0000-01-01")&&(r.date||"")<=(t||"9999-12-31"));

async function initFirebase(){
  try{
    const [{initializeApp},{getDatabase,ref,push,set,onValue,remove,runTransaction}]=await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js")
    ]);
    const app=initializeApp(firebaseConfig);
    db=getDatabase(app);
    recordsRef=ref(db,"serviceRecords");
    remindersRef=ref(db,"reminders");
    recordCounterRef=ref(db,"serviceRecordCounter");
    window.firebaseFns={ref,push,set,onValue,remove,runTransaction};
    fbReady=true;
    onValue(recordsRef,s=>{const v=s.val()||{};state.records=Object.entries(v).map(([id,r])=>({id,...r})).sort((a,b)=>(b.date||"").localeCompare(a.date||"")||(b.savedAt||"").localeCompare(a.savedAt||""));renderIfData()});
    onValue(remindersRef,s=>{const v=s.val()||{};state.reminders=Object.entries(v).map(([id,r])=>({id,...r})).filter(r=>r.status!=="sent"&&r.status!=="completed"&&r.status!=="cancelled").sort((a,b)=>(a.dueDate||"").localeCompare(b.dueDate||""));renderIfData()});
    toast("Live database connected.");
    renderIfData();
  }catch(err){
    console.error("Firebase initialization failed",err);
    toast("Database connection unavailable. App is still usable for viewing.");
  }
}
function renderIfData(){if(["dashboard","vehicles","history","reminders","reports"].includes(state.page))render()}
function toast(m){const t=$("#toast");if(!t)return;t.textContent=m;t.style.display="block";clearTimeout(window._toast);window._toast=setTimeout(()=>t.style.display="none",2600)}
function setPage(p){state.page=p;document.querySelectorAll(".nav").forEach(b=>b.classList.toggle("active",b.dataset.page===p));render()}
document.querySelectorAll(".nav").forEach(b=>b.onclick=()=>setPage(b.dataset.page)); $("#logoutBtn").onclick=()=>toast("Logout is not required in this standalone version.");

function serviceRows(e){const map={};(e?.services||[]).forEach(x=>map[x.name]=x);return SERVICES.map((n,i)=>{const x=map[n]||{};return `<div class="service-row"><div><b>${n}</b></div><input class="qty" data-i="${i}" type="number" min="0" step="1" value="${Number(x.qty||0)}"><input class="rate" data-i="${i}" type="number" min="0" step="0.01" value="${Number(x.rate||0)}"><div class="amt" id="amt-${i}">${money(x.amount||0)}</div></div>`}).join("")}
function serviceFormHTML(){const e=state.editingRecord,val=(k,d="")=>esc(e&&e[k]!==undefined?e[k]:d),sel=v=>e?.classification===v?" selected":"";
return `<div class="page-head"><h1>${e?"Edit Service Record":"New Service Record"}</h1></div>
<section class="card"><h2>Customer &amp; Vehicle Details</h2><div class="grid2">
<div><label>Service Record No.</label><input id="recordNo" value="${val("recordNo",recordNo())}" readonly></div><div><label>Date</label><input id="recordDate" type="date" value="${val("date",today())}"></div>
<div><label>Customer Name <span class="opt">(Optional)</span></label><input id="customerName" value="${val("customerName")}" placeholder="Enter customer name"></div>
<div><label>Mobile Number <span class="opt">(Optional)</span></label><input id="mobile" inputmode="numeric" value="${val("mobile")}" placeholder="10-digit mobile number"></div>
<div><label>Vehicle Model <span class="req req-vehicle">*</span></label><input id="vehicleModel" list="vehicleModels" value="${val("vehicleModel")}" placeholder="Eg. Tata Nexon"><datalist id="vehicleModels">${[...new Set(state.records.map(r=>r.vehicleModel).filter(Boolean))].sort().map(x=>`<option value="${esc(x)}">`).join("")}</datalist></div>
<div><label>Vehicle Number <span class="req req-vehicle">*</span></label><input id="vehicleNumber" list="vehicleNumbers" value="${val("vehicleNumber")}" placeholder="Eg. TN49AB1234"><datalist id="vehicleNumbers">${[...new Set(state.records.map(r=>r.vehicleNumber).filter(Boolean))].sort().map(x=>`<option value="${esc(x)}">`).join("")}</datalist><div id="vehicleDuplicateNotice" class="duplicate-notice" style="display:none"></div></div>
<div><label>Current KM Reading <span class="req req-vehicle">*</span></label><input id="currentKm" type="number" min="0" value="${e?Number(e.currentKm||0):""}" placeholder="Enter current KM"></div>
<div><label>Service Classification <span class="req">*</span></label><select id="classification"><option value="">Select classification</option><option${sel("Free Service")}>Free Service</option><option${sel("Wheel Alignment Service")}>Wheel Alignment Service</option><option${sel("Not Applicable")}>Not Applicable</option></select></div>
<div><label>Technician <span class="req req-vehicle">*</span></label><select id="technician"><option value="">Select technician</option>${TECHNICIANS.map(t=>`<option value="${t}"${val("technician")===t?" selected":""}>${t}</option>`).join("")}</select></div>
</div><p class="hint">Select an existing vehicle number to reuse customer details. For Not Applicable, customer and vehicle details are optional.</p></section>
<section class="card"><h2>Services / Charges</h2><div class="service-table"><div class="service-head"><div>SERVICE / ITEM</div><div>QTY</div><div>RATE (₹)</div><div>AMOUNT (₹)</div></div><div id="serviceRows">${serviceRows(e)}</div></div>
<div class="totals"><div class="total-line"><span>Subtotal</span><b id="subtotal">${money(e?.subtotal||0)}</b></div><div class="total-line"><span>Discount</span><input id="discount" type="number" min="0" step="0.01" value="${Number(e?.discount||0)}"></div><div class="total-line grand"><span>Grand Total</span><b id="grandTotal">${money(e?.total||0)}</b></div></div></section>
<section class="card"><h2>Service Notes</h2><div class="grid2"><div><label>Customer Complaint</label><textarea id="complaint" rows="3" placeholder="Customer complaint">${val("complaint")}</textarea></div><div><label>Work Completed / Remarks</label><textarea id="workDone" rows="3" placeholder="Work completed">${val("workDone")}</textarea></div></div></section>
<div class="bottom-actions"><button class="btn" id="clearBtn">${e?"Cancel Edit":"Clear"}</button><button class="btn blue" id="printBtn" ${e?"":"disabled"}>🖨 Print Service Record</button><button class="btn green" id="whatsappBtn" disabled>💬 WhatsApp Customer</button><button class="btn blue" id="sendRecordBtn" disabled>📄 Send Service Record</button><button class="btn primary" id="saveBtn">${e?"Update Service Record":"Save Service Record"}</button></div>`}
function getForm(){const services=SERVICES.map((name,i)=>{const qty=Number($(`.qty[data-i="${i}"]`)?.value)||0,rate=Number($(`.rate[data-i="${i}"]`)?.value)||0;return{name,qty,rate,amount:qty*rate}}).filter(x=>x.qty>0||x.rate>0);const subtotal=services.reduce((a,x)=>a+x.amount,0),discount=Math.max(0,Number($("#discount")?.value)||0);return{recordNo:$("#recordNo")?.value,date:$("#recordDate")?.value,customerName:$("#customerName")?.value.trim(),mobile:$("#mobile")?.value.trim(),vehicleModel:$("#vehicleModel")?.value.trim(),vehicleNumber:$("#vehicleNumber")?.value.trim().toUpperCase(),currentKm:Number($("#currentKm")?.value)||0,classification:$("#classification")?.value,technician:$("#technician")?.value,complaint:$("#complaint")?.value.trim(),workDone:$("#workDone")?.value.trim(),services,subtotal,discount,total:Math.max(0,subtotal-discount)}}
function calc(){if(!$("#serviceRows"))return;const f=getForm();SERVICES.forEach((n,i)=>{$(`#amt-${i}`).textContent=money(f.services.find(s=>s.name===n)?.amount||0)});$("#subtotal").textContent=money(f.subtotal);$("#grandTotal").textContent=money(f.total)}
function loadVehicle(){const v=$("#vehicleNumber")?.value.trim().toUpperCase();if(!v)return;const r=state.records.find(x=>x.vehicleNumber===v);if(r&&!state.editingRecord){["customerName","mobile","vehicleModel"].forEach(k=>{if($("#"+k)&&r[k])$("#"+k).value=r[k]});if($("#currentKm")&&!$("#currentKm").value)$("#currentKm").value=Number(r.currentKm||0);toast("Existing vehicle details loaded.");}}
function updateServiceRequiredState(){
  const na=$("#classification")?.value==="Not Applicable";
  document.querySelectorAll(".req-vehicle").forEach(el=>el.style.display=na?"none":"inline");
}

function bindService(){
  window._recordSavedThisForm=false;
  document.querySelectorAll("#main input,#main select,#main textarea").forEach(el=>el.addEventListener("input",()=>{if(window._recordSavedThisForm){window._recordSavedThisForm=false;const b=$("#saveBtn");if(b){b.textContent="Save Service Record";b.disabled=false;b.onclick=saveRecord}}calc()}));
  ["vehicleNumber"].forEach(id=>$("#"+id)?.addEventListener("change",loadVehicle));
  $("#clearBtn").onclick=()=>{state.editingRecord=null;state.savedRecord=null;window._recordSavedThisForm=false;renderService()};
  $("#saveBtn").onclick=saveRecord;
  $("#printBtn").onclick=()=>state.savedRecord&&openPrint(state.savedRecord);
  $("#whatsappBtn").onclick=()=>{if(!state.savedRecord)return;const msg=serviceCompletionMessage(state.savedRecord);if(msg)showMessageChoice(state.savedRecord,msg)};
  $("#sendRecordBtn").onclick=()=>{if(state.savedRecord)sendServiceRecordFile(state.savedRecord)};
  $("#classification").onchange=updateServiceRequiredState;
  updateServiceRequiredState();
  calc()
}
function startNewServiceRecord(){
  state.editingRecord=null;
  state.savedRecord=null;
  window._recordSavedThisForm=false;
  renderService();
}
async function makeServicePDF(f){
  const jsPDF=window.jspdf?.jsPDF;if(!jsPDF)throw new Error("PDF library unavailable");
  const doc=new jsPDF({unit:"mm",format:"a4"});
  const blue=[8,121,201], navy=[7,24,39], yellow=[255,210,26], light=[246,251,255], line=[185,205,226], text=[23,34,53], muted=[101,117,135];
  doc.setFillColor(...navy);doc.rect(0,0,210,13,"F");
  doc.setTextColor(255,255,255);doc.setFontSize(15);doc.setFont(undefined,"bold");doc.text(SHOP.name,12,9);
  doc.setTextColor(...blue);doc.setFontSize(10);doc.text(SHOP.sub,12,20);
  doc.setTextColor(...muted);doc.setFontSize(8);doc.setFont(undefined,"normal");doc.text(SHOP.address,12,26);doc.text(SHOP.phone,12,41);
  doc.setFillColor(...yellow);doc.rect(157,16,41,9,"F");doc.setTextColor(20,30,40);doc.setFontSize(9);doc.setFont(undefined,"bold");doc.text("SERVICE RECORD",161,22);
  doc.setFont(undefined,"normal");doc.setFontSize(8);doc.text(`Record No: #${f.recordNo}`,157,30);doc.text(`Date: ${f.date||"—"}`,157,35);
  let y=48;doc.setDrawColor(...line);doc.setFillColor(...light);doc.roundedRect(12,y,90,37,2,2,"FD");doc.roundedRect(108,y,90,37,2,2,"FD");
  doc.setTextColor(...blue);doc.setFontSize(7);doc.setFont(undefined,"bold");doc.text("CUSTOMER INFORMATION",16,y+6);doc.text("VEHICLE & SERVICE DETAILS",112,y+6);
  doc.setTextColor(...text);doc.setFontSize(8);doc.setFont(undefined,"normal");doc.text(`Customer Name: ${f.customerName||"—"}`,16,y+13);doc.text(`Mobile No.: ${f.mobile||"—"}`,16,y+19);
  doc.text(`Vehicle Model: ${f.vehicleModel||"—"}`,112,y+13);doc.text(`Vehicle Reg. No.: ${f.vehicleNumber||"—"}`,112,y+19);doc.text(`Current KM: ${f.currentKm?Number(f.currentKm).toLocaleString("en-IN")+" KM":"—"}`,112,y+25);doc.text(`Service Type: ${f.classification||"—"}`,112,y+31);doc.text(`Technician: ${f.technician||"—"}`,112,y+37);
  y=88;doc.setFillColor(...navy);doc.rect(12,y,186,9,"F");doc.setTextColor(255,255,255);doc.setFontSize(7);doc.setFont(undefined,"bold");doc.text("S.NO",15,y+6);doc.text("SERVICE / ITEM DESCRIPTION",28,y+6);doc.text("QTY",142,y+6);doc.text("RATE",158,y+6);doc.text("AMOUNT",179,y+6);
  doc.setTextColor(...text);doc.setFont(undefined,"normal");let n=0;for(const x of (f.services||[])){n++;y+=8;doc.setDrawColor(220,228,235);doc.line(12,y+2,198,y+2);doc.text(String(n),15,y);doc.text(String(x.name||""),28,y);doc.text(String(x.qty||0),143,y);doc.text(Number(x.rate||0).toFixed(2),158,y);doc.text(Number(x.amount||0).toFixed(2),180,y)}
  y=Math.max(y+14,145);doc.setTextColor(...blue);doc.setFontSize(8);doc.setFont(undefined,"bold");doc.text("REMARKS",12,y);doc.setTextColor(...muted);doc.setFont(undefined,"normal");doc.setFontSize(8);const remarks=f.workDone||"This document is a service record.";doc.text(doc.splitTextToSize(remarks,120),12,y+6);
  const tx=145;doc.setDrawColor(...line);doc.rect(tx,y-4,53,29);doc.setTextColor(...muted);doc.text("Subtotal",tx+4,y+2);doc.text(money(f.subtotal),tx+49,y+2,{align:"right"});doc.text("Discount",tx+4,y+9);doc.text(money(f.discount),tx+49,y+9,{align:"right"});doc.setFillColor(...navy);doc.rect(tx,y+15,53,10,"F");doc.setTextColor(255,255,255);doc.setFont(undefined,"bold");doc.text("Grand Total",tx+4,y+21);doc.text(money(f.total),tx+49,y+21,{align:"right"});
  if(f.classification!=="Not Applicable"){ y+=39;doc.setFillColor(...blue);doc.rect(12,y,186,9,"F");doc.setTextColor(255,255,255);doc.text("NEXT SERVICE SCHEDULE",78,y+6);y+=16;doc.setTextColor(...blue);doc.setFontSize(8);
  if(f.classification==="Wheel Alignment Service"||f.classification==="Regular Service"){doc.text("FREE SERVICE",25,y);doc.setTextColor(...text);doc.setFontSize(10);doc.text(`${(Number(f.currentKm||0)+2000).toLocaleString("en-IN")} KM`,25,y+7);doc.setTextColor(...muted);doc.setFontSize(7);doc.text("OR within 1 month, whichever comes first.",25,y+13);doc.setTextColor(...blue);doc.setFontSize(8);doc.text("NEXT PAID WHEEL ALIGNMENT SERVICE",112,y);doc.setTextColor(...text);doc.setFontSize(10);doc.text(`${(Number(f.currentKm||0)+5000).toLocaleString("en-IN")} KM`,112,y+7)}}
  doc.setTextColor(...muted);doc.setFontSize(7);doc.setFont(undefined,"normal");doc.text("For SRI HARI TYRES — Authorised Signatory",145,278,{align:"center"});doc.setTextColor(...blue);doc.setFontSize(9);doc.setFont(undefined,"bold");doc.text("Thank you for choosing Sri Hari Tyres.",105,286,{align:"center"});
  return doc;
}
async function sendServiceRecordFile(f){
  try{const doc=await makeServicePDF(f);const blob=doc.output("blob");const file=new File([blob],`Sri_Hari_Tyres_Service_Record_${f.recordNo}.pdf`,{type:"application/pdf"});
    if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){await navigator.share({title:`Sri Hari Tyres Service Record #${f.recordNo}`,files:[file]});}
    else {const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);toast("Service Record PDF created. Select WhatsApp to send it.");}
  }catch(e){if(e?.name!=="AbortError")alert("Could not prepare the Service Record PDF: "+(e?.message||"Unknown error"));}
}

function serviceCompletionMessage(f){
 const name=f.customerName||"Customer";
 const km=Number(f.currentKm).toLocaleString("en-IN");
 if(f.classification==="Free Service") return `SRI HARI TYRES | SERVICE UPDATE\n\nDear ${name},\n\nYour Free Service for vehicle ${f.vehicleNumber} has been successfully completed at ${km} KM.\n\nThank you for choosing SRI HARI TYRES and for your continued trust. 🙏\n\n${SHOP.name}\n${SHOP.sub}\n📍 ${SHOP.address.join("\n   ")}\n☎️ ${SHOP.phone}`;
 if(f.classification!=="Wheel Alignment Service"&&f.classification!=="Regular Service") return null;
 const freeKm=(f.currentKm+2000).toLocaleString("en-IN");
 const paidKm=(f.currentKm+5000).toLocaleString("en-IN");
 return `SRI HARI TYRES | SERVICE UPDATE\n\nDear ${name},\n\nYour Wheel Alignment Service for vehicle ${f.vehicleNumber} has been successfully completed at ${km} KM.\n\n📋 NEXT SERVICE SCHEDULE\n\n🟢 Free Service\n${freeKm} KM OR within 1 month, whichever comes first.\n\n🔵 Next Paid Wheel Alignment Service\n${paidKm} KM\n\nThank you for choosing SRI HARI TYRES and for your continued trust. 🙏\n\n${SHOP.name}\n${SHOP.sub}\n📍 ${SHOP.address.join("\n   ")}\n☎️ ${SHOP.phone}`;
}
function openWhatsApp(f,text){const p=normalizePhone(f.mobile);if(!p||!text){toast(p?"No message available.":"Mobile number is missing.");return}window.open(`https://wa.me/91${p}?text=${encodeURIComponent(text)}`,"_blank")}
async function saveRecord(){
  if(window._saving || window._recordSavedThisForm) return;
  const f=getForm();
  if(!f.classification){alert("Please select Service Classification.");return}
  const isNA=f.classification==="Not Applicable";
  if(!isNA && (!f.vehicleModel||!f.vehicleNumber||!f.currentKm)){alert("Please enter Vehicle Model, Vehicle Number and Current KM.");return}
  if(!isNA && !f.technician){alert("Please select Technician.");return}
  if(f.mobile&&!/^\d{10}$/.test(normalizePhone(f.mobile))){alert("Please enter a valid 10-digit mobile number.");return}
  if(!f.services.length){alert("Please enter at least one service or charge.");return}
  if(!fbReady||!window.firebaseFns||!db||!recordsRef){alert("Firebase database is not connected yet. Please wait a moment and try again.");return}

  window._saving=true;
  const btn=$("#saveBtn");
  btn.disabled=true;
  btn.textContent=state.editingRecord?"Updating...":"Saving...";
  try{
    let id,data;
    const {ref,set,push,runTransaction}=window.firebaseFns;
    if(state.editingRecord){
      id=state.editingRecord.id;
      const {paymentStatus,...oldWithoutPayment}=state.editingRecord;
      data={...oldWithoutPayment,...f,updatedAt:new Date().toISOString()};
    }else{
      const counterResult=await runTransaction(recordCounterRef,current=>{
        const currentKey=recordKey(current);
        if(!currentKey) return recordNo();
        return nextRecordFromMax(current);
      });
      const assignedRecordNo=counterResult.snapshot.val()||recordNo();
      f.recordNo=assignedRecordNo;
      if($("#recordNo")) $("#recordNo").value=assignedRecordNo;
      const r=push(recordsRef);
      id=r.key;
      data={...f,savedAt:new Date().toISOString(),firebaseKey:id};
    }
    await set(ref(db,`serviceRecords/${id}`),data);
    state.savedRecord={id,...data};
    const old=state.editingRecord;
    state.editingRecord=null;
    window._recordSavedThisForm=true;

    if(old) await syncRemindersForRecord(state.savedRecord);
    else if(f.classification==="Wheel Alignment Service"||f.classification==="Regular Service") await createIndependentReminders(state.savedRecord);

    $("#printBtn").disabled=false;
    const waBtn=$("#whatsappBtn");
    if(waBtn) waBtn.disabled=!(f.mobile && serviceCompletionMessage(f));
    const sendBtn=$("#sendRecordBtn");
    if(sendBtn) sendBtn.disabled=false;
    btn.textContent="✓ Saved — Start New Record";
    btn.disabled=false;
    btn.onclick=()=>startNewServiceRecord();

    showSaved(f.recordNo,!!old);
  }catch(e){
    console.error(e);
    window._recordSavedThisForm=false;
    btn.disabled=false;
    btn.textContent=state.editingRecord?"Update Service Record":"Save Service Record";
    alert("Could not save the service record: "+(e?.message||"Unknown error"));
  }finally{
    window._saving=false;
  }
}
function showSaved(no,isUpdate){const box=$("#saveStatus");box.innerHTML=`<div class="save-box"><div class="save-icon">✅</div><h3>Service Record ${isUpdate?"Updated":"Saved"}</h3><p>Record No: <b>#${esc(no)}</b><br>Saved successfully to the live database.</p><button id="savedOk">OK</button></div>`;box.style.display="flex";$("#savedOk").onclick=()=>box.style.display="none"}
function showMessageChoice(f,msg){const box=$("#saveStatus");box.innerHTML=`<div class="save-box"><div class="save-icon">💬</div><h3>WhatsApp Message</h3><p>Review the message below before opening WhatsApp.</p><div class="message-preview">${esc(msg).replace(/\n/g,"<br>")}</div><div class="choice-row"><button class="btn" id="msgClose">Cancel</button><button class="btn green" id="msgWhatsApp">Open WhatsApp</button></div></div>`;box.style.display="flex";$("#msgClose").onclick=()=>box.style.display="none";$("#msgWhatsApp").onclick=()=>{box.style.display="none";openWhatsApp(f,msg)}}

function createIndependentReminders(r){const base={vehicleNumber:r.vehicleNumber,customerName:r.customerName||"",mobile:r.mobile||"",sourceServiceId:r.id,createdAt:new Date().toISOString()};if(!fbReady)throw new Error("Firebase database is not connected.");const {push,set}=window.firebaseFns;const a=push(remindersRef),b=push(remindersRef);return Promise.all([set(a,{...base,type:"Free Service",dueDate:addDays(r.date,28),dueKm:Number(r.currentKm||0)+2000,status:"pending"}),set(b,{...base,type:"Wheel Alignment Service",dueDate:addMonths(r.date,2),dueKm:Number(r.currentKm||0)+5000,status:"pending"})])}
async function syncRemindersForRecord(r){const matches=state.reminders.filter(x=>x.sourceServiceId===r.id);const {ref,remove}=window.firebaseFns;for(const x of matches)await remove(ref(db,`reminders/${x.id}`));if((r.classification==="Wheel Alignment Service"||r.classification==="Regular Service"))await createIndependentReminders(r)}
function reminderText(x){
 const name=x.customerName||"Customer";
 if(x.type==="Free Service") return `SRI HARI TYRES | SERVICE REMINDER\n\nDear ${name},\n\nYour vehicle ${x.vehicleNumber} is now due for its Free Service.\n\n🟢 Free Service Due\n${Number(x.dueKm).toLocaleString("en-IN")} KM\n\n📅 Reminder Date\n${prettyDate(x.dueDate)}\n\nPlease visit SRI HARI TYRES at your convenience to avail your Free Service.\n\nThank you for choosing SRI HARI TYRES and for your continued trust. 🙏\n\n${SHOP.name}\n${SHOP.sub}\n📍 ${SHOP.address.join("\n   ")}\n☎️ ${SHOP.phone}`;
 return `SRI HARI TYRES | SERVICE REMINDER\n\nDear ${name},\n\nYour vehicle ${x.vehicleNumber} is now due for its Wheel Alignment Service.\n\n🔵 Wheel Alignment Service\n📅 Reminder Date\n${prettyDate(x.dueDate)}\n\nPlease visit SRI HARI TYRES at your convenience for your Wheel Alignment Service.\n\nThank you for choosing SRI HARI TYRES and for your continued trust. 🙏\n\n${SHOP.name}\n${SHOP.sub}\n📍 ${SHOP.address.join("\n   ")}\n☎️ ${SHOP.phone}`;
}
async function sendReminder(x){const text=reminderText(x);openWhatsApp(x,text);const {ref,set}=window.firebaseFns;await set(ref(db,`reminders/${x.id}`),{...x,status:"sent",sentAt:new Date().toISOString()});toast("Reminder marked as sent and removed from pending reminders.")}

function printHTML(f){const rows=(f.services?.length?f.services:[{name:"—",qty:"",rate:0,amount:0}]).map((x,i)=>`<tr><td>${i+1}</td><td><b>${esc(x.name)}</b></td><td>${x.qty}</td><td>${Number(x.rate).toFixed(2)}</td><td>${Number(x.amount).toFixed(2)}</td></tr>`).join("");const schedule=f.classification==="Not Applicable"?"":((f.classification==="Wheel Alignment Service"||f.classification==="Regular Service")?`<div class="schedule"><div><b>FREE SERVICE</b><strong>${(f.currentKm+2000).toLocaleString("en-IN")} KM</strong><span>OR within 1 month, whichever comes first.</span></div><div><b>NEXT PAID WHEEL ALIGNMENT SERVICE</b><strong>${(f.currentKm+5000).toLocaleString("en-IN")} KM</strong></div></div>`:`<div class="schedule single"><div><b>FREE SERVICE COMPLETED</b><strong>${Number(f.currentKm).toLocaleString("en-IN")} KM</strong><span>Service completed successfully.</span></div></div>`);return `<!doctype html><html><head><title>Service Record #${esc(f.recordNo)}</title><style>*{box-sizing:border-box}body{margin:0;background:#fff;font-family:Arial,sans-serif;color:#172235}.sheet{width:760px;margin:0 auto;padding:26px 30px}.top{display:flex;justify-content:space-between;border-bottom:3px solid #0879c9;padding-bottom:10px}.brand{font-size:30px;font-weight:900;color:#06447b}.sub{font-size:11px;color:#0879c9;font-weight:900;letter-spacing:1px;margin-top:4px}.addr{font-size:10px;line-height:1.55;color:#5e6c7c;margin-top:7px}.tag{background:#ffd21a;padding:10px 13px;font-weight:900;font-size:14px}.meta{font-size:10px;text-align:right;margin-top:7px;color:#5e6c7c}.boxes{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:17px}.box{border:1px solid #b9cde2;border-radius:7px;padding:12px;background:#f6fbff}.box h3{font-size:9px;letter-spacing:1px;color:#06447b;margin:0 0 9px;border-bottom:1px solid #d8e3eb;padding-bottom:6px}.kv{display:grid;grid-template-columns:115px 1fr;gap:6px;font-size:10px}.kv span{color:#667586}.kv b{color:#172235}table{width:100%;border-collapse:collapse;margin-top:17px;font-size:10px}th{background:#071827;color:#fff;padding:9px;text-align:left}td{padding:10px 8px;border-bottom:1px solid #dde5eb}th:nth-child(n+3),td:nth-child(n+3){text-align:right}td:first-child,th:first-child{text-align:center}.lower{display:grid;grid-template-columns:1fr 250px;gap:18px;margin-top:15px}.remarks{border:1px solid #b9cde2;border-radius:7px;padding:12px;background:#f6fbff}.remarks h3{font-size:10px;color:#06447b;margin:0 0 8px}.remarks p{font-size:9px;color:#657587;line-height:1.55;margin:4px 0}.tot{border:1px solid #d5e0e8}.line{display:flex;justify-content:space-between;padding:9px 10px;font-size:10px;color:#657587}.grand{background:#071827;color:#fff;font-size:14px;font-weight:900}.sign{display:flex;justify-content:flex-end;margin-top:32px;font-size:9px;font-weight:900}.sign div{width:220px;text-align:center;border-top:1px dashed #9eacb8;padding-top:7px}.schedule-wrap{margin-top:28px;border:1px solid #b9cde2;border-radius:7px;overflow:hidden}.schedule-title{background:#0879c9;color:#fff;text-align:center;font-size:13px;font-weight:900;padding:9px}.schedule{display:grid;grid-template-columns:1fr 1fr}.schedule.single{grid-template-columns:1fr}.schedule>div{padding:15px;text-align:center;border-right:1px solid #d5e0e8}.schedule>div:last-child{border-right:0}.schedule b{display:block;color:#06447b;font-size:11px}.schedule strong{display:block;font-size:17px;margin:7px 0}.schedule span{font-size:10px;color:#657587}.note{background:#fff9df;padding:9px;text-align:center;font-size:9px}.thank{margin-top:14px;text-align:center;font-size:12px;font-weight:900;color:#0879c9;background:#e9f7ff;border:1px solid #bfe4f7;padding:10px}.footer{margin-top:12px;text-align:center;font-size:9px;color:#657587}@media print{.sheet{width:100%;padding:12mm}body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body><div class="sheet"><div class="top"><div><div class="brand">${SHOP.name}</div><div class="sub">${SHOP.sub}</div><div class="addr">${SHOP.address.join("<br>")}<br>${SHOP.phone}</div></div><div><div class="tag">SERVICE RECORD</div><div class="meta">Service Record No: <b>#${esc(f.recordNo)}</b><br>Date: <b>${esc(f.date)}</b></div></div></div><div class="boxes"><div class="box"><h3>CUSTOMER INFORMATION</h3><div class="kv"><span>Customer Name:</span><b>${esc(f.customerName||"—")}</b><span>Mobile No.:</span><b>${esc(f.mobile||"—")}</b></div></div><div class="box"><h3>VEHICLE &amp; SERVICE DETAILS</h3><div class="kv"><span>Vehicle Model:</span><b>${esc(f.vehicleModel)}</b><span>Vehicle Reg. No.:</span><b>${esc(f.vehicleNumber)}</b><span>Current KM:</span><b>${Number(f.currentKm).toLocaleString("en-IN")} KM</b><span>Service Type:</span><b>${esc(f.classification)}</b><span>Technician:</span><b>${esc(f.technician||"—")}</b></div></div></div><table><thead><tr><th>S.NO</th><th>SERVICE / ITEM DESCRIPTION</th><th>QTY</th><th>RATE (₹)</th><th>AMOUNT (₹)</th></tr></thead><tbody>${rows}</tbody></table><div class="lower"><div class="remarks"><h3>REMARKS</h3><p>1. ${esc(f.workDone||"This document is a service record.")}</p><p>2. Services are performed using calibrated and computerized equipment where applicable.</p></div><div class="tot"><div class="line"><span>Subtotal</span><b>${money(f.subtotal)}</b></div><div class="line"><span>Discount</span><b>${money(f.discount)}</b></div><div class="line grand"><span>Grand Total</span><b>${money(f.total)}</b></div></div></div><div class="sign"><div>For SRI HARI TYRES<br>(Authorized Signatory)</div></div>${f.classification!=="Not Applicable"?`<div class="schedule-wrap"><div class="schedule-title">NEXT SERVICE SCHEDULE</div>${schedule}<div class="note"><b>Note:</b> Please bring this Service Record during your next visit.</div></div>`:""}<div class="thank">Thank you for choosing Sri Hari Tyres.<br><span>We appreciate your continued trust.</span></div><div class="footer">${SHOP.address.join(" • ")} &nbsp; | &nbsp; ${SHOP.phone} &nbsp; | &nbsp; Drive Safe, Stay Safe</div></div><script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></body></html>`}
function openPrint(f){const html=printHTML(f);let w=null;try{w=window.open("","_blank","width=900,height=1200")}catch(e){}if(w){w.document.open();w.document.write(html);w.document.close();setTimeout(()=>{try{w.focus();w.print()}catch(e){}},500);return}let host=$("#printHost");if(!host){host=document.createElement("div");host.id="printHost";document.body.appendChild(host)}const doc=new DOMParser().parseFromString(html,"text/html"),sheet=doc.querySelector(".sheet");if(!sheet){alert("Could not prepare the service record for printing.");return}host.innerHTML="";host.appendChild(document.importNode(sheet,true));setTimeout(()=>window.print(),120)}
window.addEventListener("afterprint",()=>{const h=$("#printHost");if(h)h.innerHTML=""});

function startOfWeek(){const d=new Date(),day=d.getDay(),diff=day===0?6:day-1;d.setDate(d.getDate()-diff);return d.toISOString().slice(0,10)}
function firstOfMonth(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`}
function filterBar(prefix,defaultsToday=true){const f=defaultsToday?today():"0000-01-01",t=defaultsToday?today():"9999-12-31";return `<div class="filterbar"><div><label>From Date</label><input id="${prefix}From" type="date" value="${f}"></div><div><label>To Date</label><input id="${prefix}To" type="date" value="${t}"></div><div class="filter-actions"><button class="btn blue" id="${prefix}Apply">Apply</button><button class="btn" id="${prefix}Clear">Clear</button></div></div><div class="quick-filters"><button data-qfilter="${prefix}:today">Today</button><button data-qfilter="${prefix}:week">This Week</button><button data-qfilter="${prefix}:month">This Month</button><button data-qfilter="${prefix}:all">All</button></div>`}
function bindDateFilter(prefix,cb){$(`#${prefix}Apply`).onclick=()=>{const f=$(`#${prefix}From`).value,t=$(`#${prefix}To`).value;if(f&&t&&f>t){alert("From Date cannot be after To Date.");return}cb(f,t)};$(`#${prefix}Clear`).onclick=()=>{const d=today();$(`#${prefix}From`).value=d;$(`#${prefix}To`).value=d;cb(d,d)};document.querySelectorAll(`[data-qfilter^="${prefix}:"]`).forEach(b=>b.onclick=()=>{const m=b.dataset.qfilter.split(":")[1];let f=today(),t=today();if(m==="week")f=startOfWeek();if(m==="month")f=firstOfMonth();if(m==="all"){f="0000-01-01";t="9999-12-31"}$(`#${prefix}From`).value=f;$(`#${prefix}To`).value=t;cb(f,t)})}
function vehicleHistory(vehicleNumber){return state.records.filter(r=>String(r.vehicleNumber||'').toUpperCase()===String(vehicleNumber||'').toUpperCase()).sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.savedAt||'').localeCompare(a.savedAt||''))}
function latestAlignmentRecord(vehicleNumber){return vehicleHistory(vehicleNumber).find(r=>r.classification==='Wheel Alignment Service'||r.classification==='Regular Service')||null}
function vehicleProfileData(vehicleNumber){const h=vehicleHistory(vehicleNumber),latest=h[0]||null,align=latestAlignmentRecord(vehicleNumber),free=align?Number(align.currentKm||0)+2000:null,paid=align?Number(align.currentKm||0)+5000:null,current=latest?Number(latest.currentKm||0):0;return {h,latest,align,free,paid,current}}
function kmProgress(current,target){if(!target||!current)return {pct:0,remaining:target?Math.max(0,target-current):0};const base=Math.max(0,target-5000),span=Math.max(1,target-base),pct=Math.min(100,Math.max(0,((current-base)/span)*100));return {pct,remaining:Math.max(0,target-current)}}
function customerReturnRate(){const map={};state.records.forEach(r=>{const v=String(r.vehicleNumber||'').trim().toUpperCase();if(v)map[v]=(map[v]||0)+1});const vehicles=Object.keys(map);const returning=vehicles.filter(v=>map[v]>1).length;return {vehicles,returning,rate:vehicles.length?Math.round(returning/vehicles.length*100):0}}
function reminderPriority(x){const now=today(),due=x.dueDate<=now;if(due)return {label:'DUE NOW',cls:'due'};const d=new Date(x.dueDate+'T00:00:00'),n=new Date(now+'T00:00:00'),days=Math.ceil((d-n)/86400000);if(days<=7)return {label:`DUE IN ${days}D`,cls:'soon'};return {label:'UPCOMING',cls:'ok'}}
async function oneTapCustomerPackage(r){if(!r)return;try{const doc=await makeServicePDF(r),blob=doc.output('blob'),file=new File([blob],`Sri_Hari_Tyres_Service_Record_${r.recordNo}.pdf`,{type:'application/pdf'}),text=serviceCompletionMessage(r)||'';if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){await navigator.share({title:`Sri Hari Tyres Service Record #${r.recordNo}`,text,files:[file]});toast('Customer package ready to share.')}else{const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);toast('PDF created. Use WhatsApp Customer for the message.')}}catch(e){if(e?.name!=='AbortError')alert('Could not prepare the customer package: '+(e?.message||'Unknown error'))}}
function vehicleProfileHTML(r){const d=vehicleProfileData(r.vehicleNumber),p=kmProgress(d.current,d.free),q=kmProgress(d.current,d.paid);const h=d.h;return `<div class="profile-panel"><div class="profile-top"><div><div class="profile-title">🚗 ${esc(r.vehicleNumber)}</div><div class="profile-sub">${esc(r.vehicleModel||d.latest?.vehicleModel||'Vehicle')} • ${h.length} service record(s)</div></div><div class="profile-actions"><button class="btn blue" data-package="${esc(r.vehicleNumber)}">📦 Customer Package</button><button class="btn" data-profile-history="${esc(r.vehicleNumber)}">View Full History</button></div></div><div class="profile-grid"><div class="profile-box"><span>Customer</span><b>${esc(r.customerName||d.latest?.customerName||'—')}</b></div><div class="profile-box"><span>Mobile</span><b>${esc(r.mobile||d.latest?.mobile||'—')}</b></div><div class="profile-box"><span>Current KM</span><b>${d.current?d.current.toLocaleString('en-IN')+' KM':'—'}</b></div><div class="profile-box"><span>Last Service</span><b>${prettyDate(d.latest?.date)}</b></div></div>${d.align?`<div class="km-card"><div class="km-head"><b>📈 KM Progress Tracker</b><span>Last alignment: ${Number(d.align.currentKm||0).toLocaleString('en-IN')} KM</span></div><div class="progress-item"><div><b>Free Service</b><span>${d.free.toLocaleString('en-IN')} KM</span></div><div class="progress"><i style="width:${p.pct}%"></i></div><small>${p.remaining.toLocaleString('en-IN')} KM remaining</small></div><div class="progress-item"><div><b>Paid Wheel Alignment</b><span>${d.paid.toLocaleString('en-IN')} KM</span></div><div class="progress"><i style="width:${q.pct}%"></i></div><small>${q.remaining.toLocaleString('en-IN')} KM remaining</small></div></div>`:''}<div class="timeline"><h4>🚗 Vehicle Service Timeline</h4>${h.slice(0,8).map(x=>`<div class="timeline-item"><div class="timeline-dot"></div><div><b>${prettyDate(x.date)} • ${Number(x.currentKm||0).toLocaleString('en-IN')} KM</b><span>${esc(x.classification||'Service')} • ${esc(x.technician||'—')}</span><small>${(x.services||[]).map(y=>esc(y.name)).join(', ')||'No service items'}</small></div></div>`).join('')}</div></div>`}

function renderDashboard(){const arr=state.records.filter(r=>r.date===today()),value=arr.reduce((a,r)=>a+Number(r.total||0),0),rem=state.reminders.filter(r=>r.dueDate===today()).length;$("#main").innerHTML=`<div class="hero"><h1>Smart Service Dashboard</h1><div>Today's service activity — ${prettyDate(today())}</div></div><div class="stat-grid"><div class="stat"><div class="label">TODAY'S VEHICLES</div><div class="num">${new Set(arr.map(r=>r.vehicleNumber).filter(Boolean)).size}</div></div><div class="stat"><div class="label">TODAY'S SERVICES</div><div class="num">${arr.length}</div></div><div class="stat"><div class="label">TODAY'S VALUE</div><div class="num">${money(value)}</div></div><div class="stat"><div class="label">CUSTOMER RETURN RATE</div><div class="num">${customerReturnRate().rate}%</div></div></div><section class="card"><div class="page-head"><h2>Today's Service Records</h2><button class="btn primary" id="dashNew">+ New Service</button></div>${arr.length?historyRows(arr,false):'<div class="empty">No service records for today.</div>'}</section>`;$("#dashNew").onclick=()=>setPage("service")}
function renderVehicles(){const latest={};state.records.filter(r=>r.date===today()).forEach(r=>{if(r.vehicleNumber&&!latest[r.vehicleNumber])latest[r.vehicleNumber]=r});const all=Object.values(latest),models=[...new Set(state.records.map(r=>r.vehicleModel).filter(Boolean))].sort();$("#main").innerHTML=`<div class="page-head"><h1>Vehicles</h1><button class="btn primary" id="newVehicleRecord">+ Service Record</button></div><section class="card"><div class="filterbar vehicle-filterbar"><div><label>Search</label><input id="vehicleSearch" placeholder="Vehicle, customer, mobile or model"></div><div><label>From Date</label><input id="vehicleFrom" type="date" value="${today()}"></div><div><label>To Date</label><input id="vehicleTo" type="date" value="${today()}"></div><div class="filter-actions"><button class="btn blue" id="vehicleApply">Apply</button><button class="btn" id="vehicleClear">Clear</button></div></div><div class="quick-filters"><button id="vehicleToday">Today</button><button id="vehicleWeek">This Week</button><button id="vehicleMonth">This Month</button><button id="vehicleAll">All</button></div><div class="grid2"><div><label>Vehicle Model</label><select id="vehicleModelFilter"><option value="">All Models</option>${models.map(m=>`<option>${esc(m)}</option>`).join("")}</select></div><div><label>Service Type</label><select id="vehicleClassFilter"><option>All Services</option><option>Free Service</option><option>Wheel Alignment Service</option><option>Not Applicable</option></select></div></div><div class="result-bar"><b id="vehicleCount">${all.length} vehicle(s)</b><span>Default: today's vehicles</span></div><div id="vehicleList">${vehicleRows(all)}</div></section>`;const paint=(f=today(),t=today())=>{let src=dateFiltered(state.records,f,t),map={};src.forEach(r=>{if(r.vehicleNumber&&!map[r.vehicleNumber])map[r.vehicleNumber]=r});let arr=Object.values(map),q=$("#vehicleSearch").value.toLowerCase().trim(),m=$("#vehicleModelFilter").value,c=$("#vehicleClassFilter").value;arr=arr.filter(r=>[r.vehicleNumber,r.customerName,r.mobile,r.vehicleModel].join(" ").toLowerCase().includes(q)&&(!m||r.vehicleModel===m)&&(c==="All Services"||state.records.some(x=>x.vehicleNumber===r.vehicleNumber&&(x.classification===c|| (c==="Wheel Alignment Service"&&x.classification==="Regular Service")))));$("#vehicleCount").textContent=`${arr.length} vehicle(s)`;$("#vehicleList").innerHTML=vehicleRows(arr)};$("#newVehicleRecord").onclick=()=>setPage("service");$("#vehicleApply").onclick=()=>paint($("#vehicleFrom").value,$("#vehicleTo").value);$("#vehicleClear").onclick=()=>{const d=today();$("#vehicleFrom").value=d;$("#vehicleTo").value=d;$("#vehicleSearch").value="";paint(d,d)};$("#vehicleSearch").oninput=()=>paint($("#vehicleFrom").value,$("#vehicleTo").value);$("#vehicleModelFilter").onchange=()=>paint($("#vehicleFrom").value,$("#vehicleTo").value);$("#vehicleClassFilter").onchange=()=>paint($("#vehicleFrom").value,$("#vehicleTo").value);$("#vehicleToday").onclick=()=>{const d=today();$("#vehicleFrom").value=d;$("#vehicleTo").value=d;paint(d,d)};$("#vehicleWeek").onclick=()=>{const f=startOfWeek(),t=today();$("#vehicleFrom").value=f;$("#vehicleTo").value=t;paint(f,t)};$("#vehicleMonth").onclick=()=>{const f=firstOfMonth(),t=today();$("#vehicleFrom").value=f;$("#vehicleTo").value=t;paint(f,t)};$("#vehicleAll").onclick=()=>paint("0000-01-01","9999-12-31")}
function vehicleRows(arr){if(!arr.length)return'<div class="empty">No vehicles found.</div>';return arr.map(r=>{const h=vehicleHistory(r.vehicleNumber),id="vh_"+r.id.replace(/[^A-Za-z0-9]/g,"_");return `<div class="vehicle-card"><div class="vehicle-head"><div><h3>${esc(r.vehicleNumber)}</h3><small>${esc(r.vehicleModel||h[0]?.vehicleModel||'Vehicle')} • ${h.length} record(s) • ${h.length>1?'Returning vehicle':'First visit'}</small></div><div class="profile-actions"><button class="btn blue" data-toggle-profile="${id}">🚘 Profile</button><button class="btn" data-toggle-history="${id}">History</button></div></div><div class="vehicle-details"><div class="detail-chip"><span>Customer</span><b>${esc(r.customerName||h[0]?.customerName||'—')}</b></div><div class="detail-chip"><span>Mobile</span><b>${esc(r.mobile||h[0]?.mobile||'—')}</b></div><div class="detail-chip"><span>Last Service</span><b>${prettyDate(h[0]?.date)}</b></div><div class="detail-chip"><span>Current KM</span><b>${Number(h[0]?.currentKm||0).toLocaleString('en-IN')} KM</b></div></div><div id="${id}" class="history-expand" hidden>${vehicleProfileHTML(r)}</div><div id="${id}_history" class="history-expand" hidden>${historyRows(h,false)}</div></div>`}).join('')}

function renderHistory(){let filtered=dateFiltered(state.records,today(),today());$("#main").innerHTML=`<div class="page-head"><h1>Service History</h1></div><section class="card">${filterBar("history")}<input class="search" id="historySearch" placeholder="Search vehicle, customer, mobile, model or record no."><div id="historyResult"></div></section>`;const paint=()=>{const q=$("#historySearch").value.toLowerCase().trim(),arr=filtered.filter(r=>[r.recordNo,r.vehicleNumber,r.customerName,r.mobile,r.vehicleModel].join(" ").toLowerCase().includes(q));$("#historyResult").innerHTML=historyRows(arr)};bindDateFilter("history",(f,t)=>{filtered=dateFiltered(state.records,f,t);paint()});$("#historySearch").oninput=paint;paint()}
function historyRows(arr,showActions=true){if(!arr.length)return'<div class="empty">No service records found.</div>';return `<div class="table-wrap"><table><thead><tr><th>Record</th><th>Date</th><th>Customer / Mobile</th><th>Vehicle</th><th>Service</th><th class="num">Total</th>${showActions?"<th>Actions</th>":""}</tr></thead><tbody>${arr.map(r=>`<tr><td>#${esc(r.recordNo)}</td><td>${prettyDate(r.date)}</td><td>${esc(r.customerName||"—")}<br>${esc(r.mobile||"—")}</td><td><b>${esc(r.vehicleNumber)}</b><br>${esc(r.vehicleModel)}<br>${Number(r.currentKm||0).toLocaleString("en-IN")} KM</td><td>${esc(r.classification)}<br>Tech: ${esc(r.technician||"—")}<br>${(r.services||[]).map(x=>esc(x.name)).join(", ")||"—"}</td><td class="num">${money(r.total)}</td>${showActions?`<td><button class="btn" data-edit="${r.id}">Edit</button> <button class="btn" data-print="${r.id}">Print</button></td>`:""}</tr>`).join("")}</tbody></table></div>`}
function renderReminders(){
  const all=state.reminders;
  $("#main").innerHTML=`<div class="page-head"><h1>Service Reminders</h1></div>
  <section class="card">
    <div class="notice">Once a reminder message is sent, that reminder is removed from the pending list. It does not create another reminder.</div>
    <div class="filterbar reminder-filterbar">
      <div><label>Search</label><input id="reminderSearch" placeholder="Vehicle, customer or mobile"></div>
      <div><label>From Date</label><input id="reminderFrom" type="date" value="${today()}"></div>
      <div><label>To Date</label><input id="reminderTo" type="date" value="${today()}"></div>
      <div class="filter-actions"><button class="btn blue" id="reminderApply">Apply</button><button class="btn" id="reminderClear">Clear</button></div>
    </div>
    <div class="quick-filters"><button id="remToday">Today</button><button id="remWeek">This Week</button><button id="remMonth">This Month</button><button id="remAll">All</button></div>
    <div class="grid2"><div><label>Reminder Type</label><select id="reminderType"><option>All</option><option>Free Service</option><option>Wheel Alignment Service</option></select></div>
    <div><label>Status</label><select id="reminderStatus"><option>All Pending</option><option>Due</option><option>Upcoming</option></select></div></div>
    <div id="reminderResult"></div>
  </section>`;
  const paint=(f=today(),t=today())=>{
    const q=$("#reminderSearch").value.toLowerCase().trim();
    const type=$("#reminderType").value;
    const status=$("#reminderStatus").value;
    const now=today();
    let arr=all.filter(x=>x.dueDate>=f&&x.dueDate<=t&&(!q||[x.vehicleNumber,x.customerName,x.mobile,x.type].join(" ").toLowerCase().includes(q))&&(type==="All"||x.type===type)&&(status==="All Pending"||(status==="Due"&&x.dueDate<=now)||(status==="Upcoming"&&x.dueDate>now))).sort((a,b)=>a.dueDate.localeCompare(b.dueDate));
    const empty='<div class="empty">No pending reminders match the selected filters.</div>';
    $("#reminderResult").innerHTML=`<div class="result-bar"><b>${arr.length} pending reminder(s)</b><span>Free: day 28 • Regular Alignment: 2 months</span></div>${arr.map(reminderCard).join("")||empty}`;
  };
  $("#reminderApply").onclick=()=>paint($("#reminderFrom").value,$("#reminderTo").value);
  $("#reminderClear").onclick=()=>{const d=today();$("#reminderFrom").value=d;$("#reminderTo").value=d;$("#reminderSearch").value="";paint(d,d)};
  $("#reminderSearch").oninput=()=>paint($("#reminderFrom").value,$("#reminderTo").value);
  $("#reminderType").onchange=()=>paint($("#reminderFrom").value,$("#reminderTo").value);
  $("#reminderStatus").onchange=()=>paint($("#reminderFrom").value,$("#reminderTo").value);
  $("#remToday").onclick=()=>{const d=today();$("#reminderFrom").value=d;$("#reminderTo").value=d;paint(d,d)};
  $("#remWeek").onclick=()=>{const f=startOfWeek(),t=today();$("#reminderFrom").value=f;$("#reminderTo").value=t;paint(f,t)};
  $("#remMonth").onclick=()=>{const f=firstOfMonth(),t=today();$("#reminderFrom").value=f;$("#reminderTo").value=t;paint(f,t)};
  $("#remAll").onclick=()=>{const f="0000-01-01",t="9999-12-31";$("#reminderFrom").value=f;$("#reminderTo").value=t;paint(f,t)};
  paint();
}
function reminderCard(x){const pr=reminderPriority(x);const action=x.mobile?'<button class="btn green" data-reminder-send="'+esc(x.id)+'">WhatsApp</button>':'<span class="badge free">No Mobile</span>';return '<div class="reminder '+(pr.cls==='due'?'priority-due':pr.cls==='soon'?'priority-soon':'')+'"><div><h3>'+esc(x.vehicleNumber)+' — '+esc(x.customerName||"Customer")+'</h3><small>'+esc(x.type)+' • Reminder: '+prettyDate(x.dueDate)+' • Reference KM: '+Number(x.dueKm||0).toLocaleString("en-IN")+' KM</small></div><div><span class="badge '+pr.cls+'">'+pr.label+'</span> '+action+'</div></div>'}
function renderReports(){
  const d=today();
  $("#main").innerHTML=`<div class="page-head"><h1>Reports</h1></div>
  <section class="card">
    <div class="filterbar report-filterbar">
      <div><label>From Date</label><input id="reportFrom" type="date" value="${d}"></div>
      <div><label>To Date</label><input id="reportTo" type="date" value="${d}"></div>
      <div class="filter-actions"><button class="btn blue" id="reportApply">Apply Filter</button><button class="btn green" id="backupExcel">⬇ Backup Excel</button></div>
    </div>
    <div class="quick-filters"><button id="reportToday">Today</button><button id="reportWeek">This Week</button><button id="reportMonth">This Month</button><button id="reportAll">All</button></div>
    <div id="reportContent"></div>
  </section>`;
  const paint=(f=today(),t=today())=>{
    const arr=dateFiltered(state.records,f,t),value=arr.reduce((a,r)=>a+Number(r.total||0),0),free=arr.filter(r=>r.classification==="Free Service").length,regular=arr.filter(r=>(r.classification==="Wheel Alignment Service"||r.classification==="Regular Service")).length;
    $("#reportContent").innerHTML=`<div class="result-bar"><b>${arr.length} service record(s)</b><span>${prettyDate(f)} to ${prettyDate(t)}</span></div><div class="stat-grid"><div class="stat"><div class="label">RECORDS</div><div class="num">${arr.length}</div></div><div class="stat"><div class="label">SERVICE VALUE</div><div class="num">${money(value)}</div></div><div class="stat"><div class="label">FREE SERVICE</div><div class="num">${free}</div></div><div class="stat"><div class="label">WHEEL ALIGNMENT SERVICE</div><div class="num">${regular}</div></div></div><div style="margin-top:14px">${historyRows(arr,false)}</div>`;
  };
  const current=()=>paint($("#reportFrom").value,$("#reportTo").value);
  $("#reportApply").onclick=current;
  $("#reportToday").onclick=()=>{ $("#reportFrom").value=d;$("#reportTo").value=d;current(); };
  $("#reportWeek").onclick=()=>{const f=startOfWeek(),t=today();$("#reportFrom").value=f;$("#reportTo").value=t;current();};
  $("#reportMonth").onclick=()=>{const f=firstOfMonth(),t=today();$("#reportFrom").value=f;$("#reportTo").value=t;current();};
  $("#reportAll").onclick=()=>{const f="0000-01-01",t="9999-12-31";$("#reportFrom").value=f;$("#reportTo").value=t;current();};
  $("#backupExcel").onclick=()=>backupExcel($("#reportFrom").value,$("#reportTo").value);
  current();
}
function backupExcel(from,to){
  if(typeof XLSX==="undefined"){alert("Excel backup library is not available. Please refresh the page and try again.");return;}
  if(!from||!to||from>to){alert("Please select a valid From Date and To Date.");return;}
  const records=dateFiltered(state.records,from,to);
  const rows=records.map(r=>({
    "Record No":r.recordNo||"","Date":r.date||"","Customer Name":r.customerName||"","Mobile":r.mobile||"",
    "Vehicle Model":r.vehicleModel||"","Vehicle Number":r.vehicleNumber||"","Current KM":Number(r.currentKm||0),
    "Service Classification":r.classification||"","Technician":r.technician||"","Customer Complaint":r.complaint||"",
    "Work Completed / Remarks":r.workDone||"","Subtotal":Number(r.subtotal||0),"Discount":Number(r.discount||0),"Grand Total":Number(r.total||0)
  }));
  const items=[];
  records.forEach(r=>(r.services||[]).forEach(x=>items.push({"Record No":r.recordNo||"","Date":r.date||"","Vehicle Number":r.vehicleNumber||"","Service / Item":x.name||"","Qty":Number(x.qty||0),"Rate":Number(x.rate||0),"Amount":Number(x.amount||0)})));
  const reminders=state.reminders.filter(x=>(x.dueDate||"")>=from&&(x.dueDate||"")<=to).map(x=>({"Reminder Type":x.type||"","Reminder Date":x.dueDate||"","Vehicle Number":x.vehicleNumber||"","Customer Name":x.customerName||"","Mobile":x.mobile||"","Due KM":Number(x.dueKm||0),"Status":x.status||"pending"}));
  const wb=XLSX.utils.book_new();
  const ws=XLSX.utils.json_to_sheet(rows.length?rows:[{"Record No":"No service records in selected period"}]);
  const wi=XLSX.utils.json_to_sheet(items.length?items:[{"Record No":"","Date":"","Vehicle Number":"","Service / Item":"No service items in selected period"}]);
  const wr=XLSX.utils.json_to_sheet(reminders.length?reminders:[{"Reminder Type":"No reminders in selected period"}]);
  XLSX.utils.book_append_sheet(wb,ws,"Service Records");XLSX.utils.book_append_sheet(wb,wi,"Service Items");XLSX.utils.book_append_sheet(wb,wr,"Reminders");
  const stamp=from===to?from:`${from}_to_${to}`;
  XLSX.writeFile(wb,`Sri_Hari_Tyres_Backup_${stamp}.xlsx`);
  toast(`Excel backup created for ${prettyDate(from)} to ${prettyDate(to)}.`);
}

document.addEventListener("click",e=>{const ed=e.target.closest("[data-edit]");if(ed){const r=state.records.find(x=>x.id===ed.dataset.edit);if(r){state.editingRecord={...r};state.savedRecord={...r};setPage("service")};return}const pr=e.target.closest("[data-print]");if(pr){const r=state.records.find(x=>x.id===pr.dataset.print);if(r)openPrint(r);return}const tog=e.target.closest("[data-toggle-history]");if(tog){const el=$("#"+tog.dataset.toggleHistory+"_history");if(el){el.hidden=!el.hidden;tog.textContent=el.hidden?"History":"Hide History"}return}const prof=e.target.closest("[data-toggle-profile]");if(prof){const el=$("#"+prof.dataset.toggleProfile);if(el){el.hidden=!el.hidden;prof.textContent=el.hidden?"🚘 Profile":"✕ Close Profile"}return}const pkg=e.target.closest("[data-package]");if(pkg){const r=state.records.filter(x=>String(x.vehicleNumber||'').toUpperCase()===String(pkg.dataset.package||'').toUpperCase()).sort((a,b)=>(b.date||'').localeCompare(a.date||''))[0];if(r)oneTapCustomerPackage(r);return}const full=e.target.closest("[data-profile-history]");if(full){setPage("history");setTimeout(()=>{const q=$("#historySearch");if(q){q.value=full.dataset.profileHistory;q.dispatchEvent(new Event('input'))}},0);return}const rs=e.target.closest("[data-reminder-send]");if(rs){const r=state.reminders.find(x=>x.id===rs.dataset.reminderSend);if(r)sendReminder(r)}});
function renderService(){$("#main").innerHTML=serviceFormHTML();bindService()}
function render(){if(state.page==="service")renderService();else if(state.page==="dashboard")renderDashboard();else if(state.page==="vehicles")renderVehicles();else if(state.page==="history")renderHistory();else if(state.page==="reminders")renderReminders();else renderReports()}
render();
initFirebase();

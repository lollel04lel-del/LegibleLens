const $ = id => document.getElementById(id);
const canvas = $('canvas'), ctx = canvas.getContext('2d');
let source = null, crop = null, selecting = false, start = null, worker = null, busy = false, runId = 0;
const status = text => $('status').textContent = text;
function counts() { const text = $('result').value; $('count').textContent = text.length + ' characters'; $('copy').disabled = $('save').disabled = !text.trim(); }
$('result').addEventListener('input', counts);
function draw() {
  if (!source) return;
  ctx.drawImage(source,0,0,canvas.width,canvas.height);
  if (crop) { ctx.strokeStyle='#759c30';ctx.lineWidth=Math.max(3,canvas.width/220);ctx.strokeRect(crop.x,crop.y,crop.w,crop.h); }
}
function setImage(image) {
  const ratio = Math.min(1,2200/Math.max(image.width,image.height));
  canvas.width = Math.round(image.width*ratio); canvas.height = Math.round(image.height*ratio);
  source = document.createElement('canvas');source.width=canvas.width;source.height=canvas.height;
  source.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
  crop=null;selecting=false;start=null;canvas.classList.remove('cropping');$('reset').hidden=true;$('crop').textContent='Select a region';
  $('upload').hidden=true;$('preview').hidden=false;$('scan').disabled=false;$('result').value='';counts();draw();
  $('image-hint').textContent='Scan the whole image, or select a smaller region.';status('Image ready. Choose the text language, then scan.');
}
$('image').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file || busy) return;
  if (file.size > 20*1024*1024) {status('Please choose an image smaller than 20 MB.');event.target.value='';return;}
  const url=URL.createObjectURL(file);
  try {const image=new Image();image.src=url;await image.decode();setImage(image);}
  catch {status('This image could not be opened. Try a JPG, PNG, or WEBP.');}
  finally {URL.revokeObjectURL(url);event.target.value='';}
});
$('sample').onclick=()=>{
  const sample=document.createElement('canvas');sample.width=1000;sample.height=400;
  const c=sample.getContext('2d');c.fillStyle='white';c.fillRect(0,0,1000,400);c.fillStyle='#111';c.font='bold 62px Arial';c.fillText('Make every image readable.',45,140);c.font='40px Arial';c.fillText('Welcome to LegibleLens.',45,230);
  $('language').value='eng';setImage(sample);
};
$('crop').onclick=()=>{selecting=!selecting;canvas.classList.toggle('cropping',selecting);$('crop').textContent=selecting?'Done selecting':'Select a region';$('image-hint').textContent=selecting?'Drag across the text with your finger. Tap Done selecting to scroll normally.':'Scan the selected region, or use the full image.';};
function point(e){const r=canvas.getBoundingClientRect();return {x:Math.max(0,Math.min(canvas.width,(e.clientX-r.left)*canvas.width/r.width)),y:Math.max(0,Math.min(canvas.height,(e.clientY-r.top)*canvas.height/r.height))};}
canvas.onpointerdown=e=>{if(!selecting||busy)return;start=point(e);canvas.setPointerCapture(e.pointerId);};
canvas.onpointermove=e=>{if(!start)return;const end=point(e);crop={x:Math.min(start.x,end.x),y:Math.min(start.y,end.y),w:Math.abs(start.x-end.x),h:Math.abs(start.y-end.y)};draw();};
function endSelection(){if(!start)return;start=null;if(!crop||crop.w<10||crop.h<10)crop=null;$('reset').hidden=!crop;draw();}
canvas.onpointerup=endSelection;canvas.onpointercancel=endSelection;
$('reset').onclick=()=>{crop=null;$('reset').hidden=true;draw();};
function setBusy(value){busy=value;for(const id of ['image','language','scan','sample','crop','reset'])$(id).disabled=value;$('cancel').hidden=!value;$('progress').hidden=!value;}
$('cancel').onclick=async()=>{runId++;const active=worker;worker=null;setBusy(false);status('Scan cancelled. Your image is ready to try again.');if(active)await active.terminate();};
$('scan').onclick=async()=>{
  if(!source||busy)return;const id=++runId;setBusy(true);$('progress').value=0;status('Loading the OCR engine…');let localWorker;
  const current = () => id===runId;
  try {
    localWorker=await Tesseract.createWorker($('language').value,1,{workerPath:'/vendor/worker.min.js',corePath:'/core',langPath:'/ocr',logger:m=>{if(current()){status(m.status==='recognizing text'?'Reading your image… '+Math.round(m.progress*100)+'%':'Preparing OCR: '+m.status+'…');$('progress').value=m.progress||0;}}});
    if(!current()){await localWorker.terminate();return;}worker=localWorker;
    let input=source;
    if(crop){input=document.createElement('canvas');input.width=Math.round(crop.w);input.height=Math.round(crop.h);input.getContext('2d').drawImage(source,crop.x,crop.y,crop.w,crop.h,0,0,input.width,input.height);}
    const {data}=await localWorker.recognize(input);
    if(current()){$('result').value=data.text.trim();counts();status(data.text.trim()?'Text ready. Check it for mistakes, then copy or save.':'No text found. Try a sharper image or a smaller region.');}
  } catch(error){if(current())status('Scan failed. Try again with a smaller, clearer image. '+(error.message||''));}
  finally {if(localWorker)await localWorker.terminate().catch(()=>{});if(current()){worker=null;setBusy(false);}}
};
$('copy').onclick=async()=>{
  try {if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText($('result').value);else {$('result').focus();$('result').select();if(!document.execCommand('copy'))throw new Error('manual');}status('Text copied.');}
  catch { $('result').focus();$('result').select();status('Text selected. Long-press it and choose Copy.'); }
};
$('save').onclick=()=>{const url=URL.createObjectURL(new Blob([$('result').value],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='legiblelens.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status('Text file downloaded.');};

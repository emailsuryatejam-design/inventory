function w(){return new Uint8Array([27,64])}function b(t=1){return new Uint8Array(Array(t).fill(10))}function s(t){return new Uint8Array([27,69,t?1:0])}function g(){return new Uint8Array([27,97,1])}function _(){return new Uint8Array([27,97,0])}function h(t=1,n=1){const e=t-1<<4|n-1;return new Uint8Array([29,33,e])}function v(){return new Uint8Array([29,86,1])}function r(t){return new TextEncoder().encode(t)}function c(t="-",n=48){return r(t.repeat(n)+`
`)}function l(t,n){return t.length>=n?t.substring(0,n):t+" ".repeat(n-t.length)}function p(t,n){return t.length>=n?t.substring(0,n):" ".repeat(n-t.length)+t}function C(...t){const n=t.reduce((a,y)=>a+y.length,0),e=new Uint8Array(n);let f=0;for(const a of t)e.set(a,f),f+=a.length;return e}function L(t,n={}){const e=n.printerWidth||48,f=n.campName||"WebSquare",a=u=>Math.round(u).toLocaleString("en-US"),y=t.created_at?new Date(t.created_at).toLocaleString("en-GB",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}):new Date().toLocaleString("en-GB"),o=[w(),g(),s(!0),h(2,2),r(f+`
`),h(1,1),s(!1)];if(n.headerText&&o.push(r(n.headerText+`
`)),o.push(c("-",e),_(),r(`Voucher: ${t.voucher_number}
`),r(`Date:    ${y}
`)),t.service_type){const u=typeof t.service_type=="object"?t.service_type.label:t.service_type;o.push(r(`Service: ${u}
`))}t.table_number&&o.push(r(`Table:   ${t.table_number}
`)),o.push(c("-",e));const d=4,i=10,m=e-d-i-2;o.push(s(!0),r(l("Qty",d)+" "+l("Item",m)+" "+p("Amount",i)+`
`),s(!1),c("-",e));for(const u of t.items||[]){const S=u.qty||1,x=u.price||0,A=a(S*x),T=(u.name||"").substring(0,m);o.push(r(l(String(S),d)+" "+l(T,m)+" "+p(A,i)+`
`))}return o.push(c("=",e)),o.push(s(!0),h(1,2),r(l("TOTAL",e-i-5)+" TZS "+p(a(t.total_value),i)+`
`),h(1,1),s(!1),c("-",e)),t.received_by&&o.push(r(`Served by: ${t.received_by}
`)),o.push(b(1),g(),r((n.footerText||"Thank you for visiting!")+`
`),r(`WebSquare by Vyoma AI Studios
`),b(3),v()),C(...o)}async function U(t,n){const e=await fetch(n,{method:"POST",headers:{"Content-Type":"application/octet-stream"},body:t});if(!e.ok)throw new Error(`Printer error: ${e.status} ${e.statusText}`);return!0}export{L as generateReceiptCommands,U as sendToNetworkPrinter};

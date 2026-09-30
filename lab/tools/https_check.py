"""
فاحص HTTPS الحقيقي — بيتصل بالموقع بنفسه ويعمل نفس فحوصات المتصفح.
مش محتاج أي مكتبات: كله من مكتبة بايثون الأساسية.

التشغيل:
    python https_check.py google.com
أو من غير اسم وهو هيسألك.
"""
import datetime
import http.client
import socket
import ssl
import sys

# عشان الحروف العربي تظهر صح في الـ Terminal على ويندوز
try:
    sys.stdout.reconfigure(encoding="utf-8")
except AttributeError:
    pass

TIMEOUT = 20


def clean_host(text):
    """يشيل https:// والمسار من اللي الطالب كتبه: https://www.google.com/search -> www.google.com"""
    text = text.strip().lower()
    if "://" in text:
        text = text.split("://", 1)[1]
    return text.split("/")[0].split(":")[0]


def check_dns(host):
    """1) هل الموقع موجود أصلاً؟"""
    try:
        return socket.gethostbyname(host)
    except socket.gaierror:
        return None


def check_http_redirect(host):
    """2) لو حد كتب http:// من غير s — الموقع بيحوّله لـ https ولا بيفضل مكشوف؟
    بنمشي ورا التحويلات (ممكن http://google.com ← http://www.google.com ← https://...)"""
    current, path = host, "/"
    for _ in range(5):
        try:
            conn = http.client.HTTPConnection(current, 80, timeout=TIMEOUT)
            conn.request("GET", path, headers={"User-Agent": "school-https-checker"})
            resp = conn.getresponse()
            location = resp.getheader("Location", "")
            conn.close()
        except ConnectionRefusedError:
            return "closed", None  # منفذ 80 مقفول — مفيش نسخة غير مشفّرة
        except (socket.timeout, TimeoutError):
            return "unknown", "الموقع مارديش على http في الوقت المحدد"
        except (OSError, http.client.HTTPException) as e:
            return "unknown", str(e)
        if resp.status not in (301, 302, 303, 307, 308) or not location:
            return "open", resp.status  # الصفحة اتعرضت على http من غير تشفير
        if location.lower().startswith("https://"):
            return "redirect", location
        if location.lower().startswith("http://"):
            rest = location[7:]
            current, path = rest.split("/", 1)[0], "/" + (rest.split("/", 1)[1] if "/" in rest else "")
        else:
            path = location if location.startswith("/") else "/" + location
    return "open", "تحويلات كتير"


def check_tls(host):
    """3) الاتصال المشفّر: المصافحة + التحقق من الشهادة (السلسلة والاسم والتاريخ)"""
    context = ssl.create_default_context()  # نفس الجهات الموثوقة اللي في الجهاز
    try:
        with socket.create_connection((host, 443), timeout=TIMEOUT) as raw:
            with context.wrap_socket(raw, server_hostname=host) as tls:
                return {
                    "ok": True,
                    "version": tls.version(),
                    "cipher": tls.cipher()[0],
                    "bits": tls.cipher()[2],
                    "cert": tls.getpeercert(),
                }
    except ssl.SSLCertVerificationError as e:
        return {"ok": False, "reason": explain_cert_error(e.verify_message or str(e))}
    except ssl.SSLError as e:
        return {"ok": False, "reason": f"فشل التشفير: {e.reason}"}
    except (socket.timeout, TimeoutError):
        return {"ok": False, "reason": "الموقع مابيردش على منفذ 443 — غالبًا مابيدعمش HTTPS خالص"}
    except OSError as e:
        return {"ok": False, "reason": f"مش قادر أتصل بالمنفذ 443 ({e.strerror or e})"}


def explain_cert_error(msg):
    """ترجمة رسالة الخطأ الإنجليزي لشرح مفهوم"""
    m = msg.lower()
    if "expired" in m:
        return "الشهادة منتهية الصلاحية ⏰"
    if "in certificate chain" in m:
        return "سلسلة الشهادة بتنتهي عند جهة جذرية مش موثوقة 🚫"
    if "self-signed" in m or "self signed" in m:
        return "الشهادة موقّعة ذاتيًا — الموقع موقّعها لنفسه ✍️"
    if "hostname mismatch" in m or "doesn't match" in m or "not valid for" in m:
        return "الشهادة مش لنفس اسم الموقع 🏷️"
    if "unable to get local issuer" in m or "unknown ca" in m or "untrusted" in m:
        return "الشهادة صادرة من جهة مش موثوقة 🚫"
    if "revoked" in m:
        return "الشهادة اتلغت (Revoked) 🚫"
    return msg


def check_hsts(host):
    """4) HSTS: هل الموقع بيقول للمتصفح 'ماتكلمنيش غير بـ HTTPS'؟"""
    try:
        conn = http.client.HTTPSConnection(host, 443, timeout=TIMEOUT, context=ssl.create_default_context())
        conn.request("HEAD", "/", headers={"User-Agent": "school-https-checker"})
        value = conn.getresponse().getheader("Strict-Transport-Security")
        conn.close()
        return value
    except (OSError, http.client.HTTPException):
        return None


def name_of(field):
    """بيطلّع الاسم (CN أو O) من subject/issuer بتاع الشهادة"""
    parts = dict(x[0] for x in field)
    return parts.get("commonName") or parts.get("organizationName") or "?"


def main():
    host = clean_host(sys.argv[1] if len(sys.argv) > 1 else input("اكتب اسم الموقع: "))
    print(f"\n🔍 بفحص: {host}\n" + "─" * 45)
    score, total = 0, 4

    # 1) DNS
    ip = check_dns(host)
    if not ip:
        print("❌ الموقع ده مش موجود (DNS مش لاقي عنوانه)")
        return
    print(f"🌐 عنوان الـ IP: {ip}")

    # 2) الاتصال المشفّر
    tls = check_tls(host)
    if tls["ok"]:
        score += 2
        cert = tls["cert"]
        expires = datetime.datetime.fromtimestamp(
            ssl.cert_time_to_seconds(cert["notAfter"]), datetime.timezone.utc)
        days = (expires - datetime.datetime.now(datetime.timezone.utc)).days
        print("✅ الاتصال مشفّر والشهادة سليمة (السلسلة + الاسم + التاريخ)")
        print(f"   🔐 البروتوكول: {tls['version']}   التشفير: {tls['cipher']} ({tls['bits']} بت)")
        print(f"   📄 صادرة لـ: {name_of(cert['subject'])}")
        print(f"   🏢 صادرة من: {name_of(cert['issuer'])}")
        print(f"   📅 سارية لحد: {expires:%Y-%m-%d} (باقي {days} يوم){'  ⚠️ قربت تخلص' if days < 15 else ''}")
        if tls["version"] in ("TLSv1", "TLSv1.1"):
            print("   ⚠️ إصدار TLS قديم وضعيف")
        else:
            score += 1
    else:
        print(f"❌ الاتصال المشفّر فشل: {tls['reason']}")
        print("   المتصفح هيطلّع تحذير: 'الاتصال ليس خاصًا'")

    # 3) تحويل HTTP لـ HTTPS
    kind, detail = check_http_redirect(host)
    if kind == "redirect":
        print("✅ لو حد كتب http:// بيتحوّل تلقائي لـ https://")
    elif kind == "closed":
        print("✅ منفذ HTTP (80) مقفول — مفيش نسخة غير مشفّرة")
    elif kind == "unknown":
        print(f"❔ مقدرتش أعرف سلوك http:// ({detail})")
    else:
        print(f"⚠️ الموقع بيرد على http:// من غير تحويل (كود {detail}) — البيانات ممكن تتبعت مكشوفة")

    # 4) HSTS
    if tls["ok"]:
        hsts = check_hsts(host)
        if hsts:
            score += 1
            print("✅ HSTS مفعّل — المتصفح هيرفض أي اتصال غير مشفّر بالموقع ده")
        else:
            print("ℹ️ HSTS مش مفعّل (حماية إضافية مش موجودة)")

    print("─" * 45)
    if not tls["ok"]:
        print("🔴 النتيجة: الموقع ده مش مشفّر بشكل آمن")
    elif kind == "open":
        print(f"🟡 النتيجة: مشفّر، بس لسه فيه نسخة مكشوفة على http:// ({score}/{total})")
    else:
        print(f"🟢 النتيجة: الموقع مشفّر فعلاً ({score}/{total})")


if __name__ == "__main__":
    main()

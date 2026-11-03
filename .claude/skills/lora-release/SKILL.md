---
name: lora-release
description: Checklist for shipping any change to the Lora Collection app (index.html) — mockup approval, version bump, tests, real-backup check, commit and the Arabic reply with the merge link. Use for every change to the app.
---
# إصدار جديد لـ Lora Collection

1. **اتفاق:** تغيير في الشكل أو الطريقة؟ ماكيت الأول (صورة بأرقام إسلام) واستنى «نفذ».
2. **التعديل:** على `claude/code-review-3isa4q`. اتبع `DESIGN.md`. ما تلمسش مفاتيح التخزين.
3. **الإصدار:** `var VERSION = "N"` + أول سطر في `CHANGELOG` بنفس الرقم والتاريخ، بالعربي المصري، بيقول اتغيّر إيه بالنسبة له.
4. **اختبار:** لو غلطة → اختبار بيطلّعها الأول (`test-writer`). بعدين `npm test` لازم كله يعدّي.
5. **مراجعة:** فلوس أو مخزون أو تقارير → `accounting-reviewer`. شكل → `ui-reviewer` (صور كمبيوتر وموبايل، ليلي ونهاري).
6. **أرقامه الحقيقية:** جرّب على آخر باك أب بعته (من مكانه، من غير ما يتحفظ في المشروع) وطلّع إيه اللي هيتغيّر في أرقامه بالظبط.
7. **الكوميت:** رسالة إنجليزي واضحة + السطرين بالظبط:
   ```
   Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
   Claude-Session: https://claude.ai/code/session_01GGTppJdUGqyQk7m7ekFBke
   ```
   وبعدين `git push -u origin claude/code-review-3isa4q`.
8. **الرد لإسلام:** عربي مصري · اللي اتغيّر · اللي هيتغيّر في أرقامه (جدول) · الصور · الخطوات المرقّمة · لينك الـ merge:
   https://github.com/Eslamwahed/naya/compare/claude/code-review-3isa4q?expand=1

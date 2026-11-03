#!/bin/bash
# بيجهّز الاختبارات في أول كل جلسة على الويب — مش بيوقف الجلسة لو حاجة فشلت
cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || exit 0
[ "$CLAUDE_CODE_REMOTE" = "true" ] || exit 0
if ! node -e "require('playwright')" 2>/dev/null; then
  npm install --no-audit --no-fund --silent >/dev/null 2>&1 || true
fi
echo "Lora Collection: اقرا CLAUDE.md و DESIGN.md · الاختبارات: npm test"
exit 0

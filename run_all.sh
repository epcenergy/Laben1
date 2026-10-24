#!/bin/sh
# Τρέχει όλες τις δοκιμές. Χρειάζεται τον τοπικό server: python3 -m http.server 8765 (στον φάκελο της εφαρμογής)
cd "$(dirname "$0")/.." || exit 1
fail=0
for t in test_app test_capacity test_print_button test_print test_colors test_edge; do
  echo "=== $t"; python3 tests/$t.py | grep -E "^(FAIL|FAILED)" || true
  python3 tests/$t.py >/dev/null 2>&1 || fail=1
done
[ $fail = 0 ] && echo "ΟΛΕΣ ΟΙ ΔΟΚΙΜΕΣ ΠΕΡΑΣΑΝ" || echo "ΥΠΑΡΧΟΥΝ ΑΠΟΤΥΧΙΕΣ"
exit $fail

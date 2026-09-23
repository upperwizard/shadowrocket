[Script]
isvoro = type=http-request,engine=jsc,script-path=isvoro.js,pattern=^https:\/\/isvoro\.com\/checkin$,max-size=131072,timeout=10,script-update-interval=0,argument=ENABLE_CAPTURE={{{Token捕获}}},enable=true

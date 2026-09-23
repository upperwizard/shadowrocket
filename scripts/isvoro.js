const args = typeof $argument !== "undefined" ? $argument : "";
const captureEnabled = args.indexOf("ENABLE_CAPTURE=true") !== -1;

(function () {

    var KEY = "isvoro_auth";

    function notify(msg) {
        $notification.post("ISVORO", "", msg);
    }

    // =========================
    // HTTP-REQUEST：抓取 Token
    // =========================
    if (typeof $request !== "undefined") {

        // Token捕获=false → 不抓取 Token
        if (!captureEnabled) {
            $done({});
            return;
        }

        var cookie =
            $request.headers.Cookie ||
            $request.headers.cookie ||
            "";

        var access = cookie.match(/(?:^|;\s*)pmt_access=([^;]+)/);
        var csrf = cookie.match(/(?:^|;\s*)pmt_csrf=([^;]+)/);

        if (access && csrf) {

            var token = JSON.stringify({
                pmt_access: access[1],
                pmt_csrf: csrf[1]
            });

            var old = $persistentStore.read(KEY);

            if (old !== token) {
                $persistentStore.write(token, KEY);
                notify("Token 已更新");
            }
        }

        $done({});
        return;
    }


    // =========================
    // CRON：自动签到
    // =========================

    var raw = $persistentStore.read(KEY);

    if (!raw) {
        notify("没有 Token");
        $done();
        return;
    }

    var auth;

    try {
        auth = JSON.parse(raw);
    } catch (e) {
        $persistentStore.write("", KEY);
        notify("Token 数据损坏，已删除");
        $done();
        return;
    }

    $httpClient.post({
        url: "https://isvoro.com/api/v1/points/checkin",

        headers: {
            "Cookie":
                "pmt_access=" + auth.pmt_access +
                "; pmt_csrf=" + auth.pmt_csrf,

            "X-CSRF-Token": auth.pmt_csrf,

            "Referer": "https://isvoro.com/checkin",

            "Accept": "application/json"
        }

    }, function (error, response, body) {

        if (error) {
            notify("签到网络错误：" + error);
            $done();
            return;
        }

        // Token 失效 → 删除旧 Token
        if (response.status === 401 || response.status === 403) {

            $persistentStore.write("", KEY);

            notify("Token 已失效，已删除，请重新捕获");

            $done();
            return;
        }

        var msg = "";

        try {
            var json = JSON.parse(body);

            msg =
                json.message ||
                json.msg ||
                json.status_msg ||
                json.detail ||
                "";

        } catch (e) {}

        notify(msg || ("签到 HTTP " + response.status));

        $done();
    });

})();

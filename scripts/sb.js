const SESSION_KEY = "sb_session";
const args =
    typeof $argument !== "undefined" ? $argument : "";
const captureEnabled =
    args.indexOf("ENABLE_CAPTURE=true") !== -1;
/*
 * =========================
 * HTTP Request
 * 捕获烧饼论坛 Session
 * =========================
 */
if ($script.type === "http-request") {
    if (captureEnabled) {
        const headers =
            $request.headers || {};
        const cookie =
            headers["Cookie"] ||
            headers["cookie"] ||
            "";
        /*
         * 从 Cookie 中提取 __Host-bbs_session
         */
        const match =
            cookie.match(
                /(?:^|;\s*)__Host-bbs_session=([^;]+)/
            );
        if (match && match[1]) {
            const newSession = match[1];
            const oldSession =
                $persistentStore.read(SESSION_KEY);
            /*
             * 第一次保存，或者 Session 发生变化
             */
            if (
                !oldSession ||
                newSession !== oldSession
            ) {
                $persistentStore.write(
                    newSession,
                    SESSION_KEY
                );
                $notification.post(
                    "烧饼论坛",
                    "Session 捕获成功",
                    "新的 Session 已保存"
                );
            }
        }
    }
    $done({});
}
/*
 * =========================
 * Cron
 * 自动签到
 * =========================
 */
else if ($script.type === "cron") {
    const session =
        $persistentStore.read(SESSION_KEY);
    /*
     * 没有 Session
     */
    if (!session) {
        $notification.post(
            "烧饼自动签到",
            "签到失败",
            "没有保存 Session，请先开启 Token 捕获"
        );
        $done({});
    } else {
        /*
         * 第一步：
         * GET /signin/ 获取最新 CSRF
         */
        $httpClient.get({
            url:
                "https://sb.sb/signin/",
            headers: {
                "Cookie":
                    "__Host-bbs_session=" + session,
                "Accept":
                    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Referer":
                    "https://sb.sb/signin/",
                "User-Agent":
                    "Mozilla/5.0"
            },
            timeout: 10
        }, function(error, response, body) {
            /*
             * GET 请求失败
             */
            if (error) {
                $notification.post(
                    "烧饼自动签到",
                    "请求失败",
                    String(error)
                );
                $done({});
                return;
            }
            /*
             * HTTP 401 / 403
             * Session 失效
             */
            if (
                response &&
                (
                    response.status === 401 ||
                    response.status === 403
                )
            ) {
                $persistentStore.write(
                    "",
                    SESSION_KEY
                );
                $notification.post(
                    "烧饼自动签到",
                    "Session 已失效",
                    "HTTP " + response.status
                );
                $done({});
                return;
            }
            /*
             * 从签到页面提取 CSRF
             *
             * 兼容：
             * <input ... name="_csrf" value="xxx">
             */
            let csrf = null;
            let csrfMatch =
                body.match(
                    /name=["']_csrf["'][^>]*value=["']([^"']+)["']/i
                );
            if (!csrfMatch) {
                csrfMatch =
                    body.match(
                        /value=["']([^"']+)["'][^>]*name=["']_csrf["']/i
                    );
            }
            if (csrfMatch) {
                csrf = csrfMatch[1];
            }
            /*
             * 没找到 CSRF
             */
            if (!csrf) {
                $notification.post(
                    "烧饼自动签到",
                    "签到失败",
                    "无法从签到页面获取 CSRF"
                );
                $done({});
                return;
            }
            /*
             * 第二步：
             * POST /signin/
             */
            const postBody =
                "_csrf=" +
                encodeURIComponent(csrf) +
                "&message=";
            $httpClient.post({
                url:
                    "https://sb.sb/signin/",
                headers: {
                    "Cookie":
                        "__Host-bbs_session=" + session,
                    "Content-Type":
                        "application/x-www-form-urlencoded",
                    "Origin":
                        "https://sb.sb",
                    "Referer":
                        "https://sb.sb/signin/",
                    "User-Agent":
                        "Mozilla/5.0",
                    "Accept":
                        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
                },
                body:
                    postBody,
                timeout: 10
            }, function(error, response, body) {
                /*
                 * POST 请求失败
                 */
                if (error) {
                    $notification.post(
                        "烧饼自动签到",
                        "请求失败",
                        String(error)
                    );
                    $done({});
                    return;
                }
                /*
                 * HTTP 401 / 403
                 * Session 失效
                 */
                if (
                    response &&
                    (
                        response.status === 401 ||
                        response.status === 403
                    )
                ) {
                    $persistentStore.write(
                        "",
                        SESSION_KEY
                    );
                    $notification.post(
                        "烧饼自动签到",
                        "Session 已失效",
                        "HTTP " + response.status
                    );
                    $done({});
                    return;
                }
                /*
                 * 根据返回页面判断签到结果
                 */
                if (
                    body &&
                    (
                        body.indexOf("今天已经签到") !== -1 ||
                        body.indexOf("今日已经签到") !== -1 ||
                        body.indexOf("今天已签到") !== -1 ||
                        body.indexOf("今日已签到") !== -1
                    )
                ) {
                    $notification.post(
                        "烧饼自动签到",
                        "今天已签到",
                        "签到状态正常"
                    );
                }
                else if (
                    body &&
                    (
                        body.indexOf("签到成功") !== -1 ||
                        body.indexOf("签到完成") !== -1
                    )
                ) {
                    $notification.post(
                        "烧饼自动签到",
                        "签到成功",
                        "签到完成"
                    );
                }
                else {
                    $notification.post(
                        "烧饼自动签到",
                        "签到请求已完成",
                        "HTTP " +
                        (response
                            ? response.status
                            : "未知")
                    );
                }
                $done({});
            });
        });
    }
}
/*
 * =========================
 * 其他情况
 * =========================
 */
else {
    $done({});
}

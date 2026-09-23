const TOKEN_KEY = "akile_authorization";

const args = typeof $argument !== "undefined" ? $argument : "";
const captureEnabled = args.indexOf("ENABLE_CAPTURE=true") !== -1;


/*
 * =========================
 * HTTP Request
 * 捕获 Akile Authorization
 * =========================
 */
if ($script.type === "http-request") {

    if (captureEnabled) {

        const headers = $request.headers || {};

        const auth =
            headers["Authorization"] ||
            headers["authorization"];

        if (auth) {

            const oldAuth =
                $persistentStore.read(TOKEN_KEY);

            if (!oldAuth || auth !== oldAuth) {

                $persistentStore.write(
                    auth,
                    TOKEN_KEY
                );

                $notification.post(
                    "Akile",
                    "Token 捕获成功",
                    "新的 Authorization 已保存"
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

    const auth =
        $persistentStore.read(TOKEN_KEY);

    if (!auth) {

        $notification.post(
            "Akile 自动签到",
            "签到失败",
            "没有保存 Authorization"
        );

        $done({});

    } else {

        $httpClient.get({

            url:
                "https://api.akile.ai/api/v1/user/Checkin",

            headers: {
                "Authorization": auth,
                "Accept":
                    "application/json, text/plain, */*",
                "Origin":
                    "https://akile.ai",
                "Referer":
                    "https://akile.ai/"
            }

        }, function(error, response, body) {


            /*
             * 请求层错误
             */
            if (error) {

                let detail = String(error);

                if (response) {
                    detail +=
                        " | HTTP " +
                        String(response.status);
                }

                if (body) {
                    detail +=
                        " | " +
                        String(body).substring(0, 200);
                }

                $notification.post(
                    "Akile 自动签到",
                    "请求失败",
                    detail
                );

                $done({});
                return;
            }


            /*
             * HTTP 状态异常
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
                    TOKEN_KEY
                );

                $notification.post(
                    "Akile 自动签到",
                    "Token 已失效",
                    "HTTP " + response.status
                );

                $done({});
                return;
            }


            /*
             * HTTP 其他异常
             */
            if (
                response &&
                response.status >= 400
            ) {

                $notification.post(
                    "Akile 自动签到",
                    "HTTP 请求异常",
                    "HTTP " +
                    response.status +
                    (body
                        ? " | " +
                          String(body).substring(0, 200)
                        : "")
                );

                $done({});
                return;
            }


            /*
             * 解析 Akile 返回
             */
            try {

                const result =
                    JSON.parse(body);


                /*
                 * API Token 失效
                 */
                if (
                    result.status_code === 401 ||
                    result.status_code === 403
                ) {

                    $persistentStore.write(
                        "",
                        TOKEN_KEY
                    );

                    $notification.post(
                        "Akile 自动签到",
                        "Token 已失效",
                        "API status_code: " +
                        result.status_code
                    );

                    $done({});
                    return;
                }


                /*
                 * 正常结果
                 */
                $notification.post(
                    "Akile 自动签到",
                    result.status_msg ||
                    "签到完成",
                    "status_code: " +
                    result.status_code
                );

            }

            catch (e) {

                $notification.post(
                    "Akile 自动签到",
                    "返回解析失败",
                    String(body).substring(0, 200)
                );
            }

            $done({});
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

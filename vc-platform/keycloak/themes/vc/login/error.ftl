<#-- Trang lỗi của VC ID (thiết kế SSO mục 5.1.6): câu tiếng Việt; sai domain thì có nút chọn tài khoản khác;
     thời điểm (và mã theo dõi nếu có) để báo IT. Dựa trên base/login/error.ftl của Keycloak 26. -->
<#import "template.ftl" as layout>
<@layout.registrationLayout displayMessage=false; section>
    <#if section = "header">
        ${kcSanitize(msg("errorTitle"))?no_esc}
    <#elseif section = "form">
        <div id="kc-error-message">
            <p class="instruction">${kcSanitize(message.summary)?no_esc}</p>
            <#assign veApp = (client?? && client.baseUrl?has_content)?then(client.baseUrl, properties.vcHomeUrl)>
            <#if message.summary == msg("federatedIdentityUnmatchedEssentialClaimMessage")>
                <#-- Mở lại app: VC ID chuyển sang Google, Google hiện danh sách tài khoản (prompt=select_account). -->
                <a id="vc-chon-tai-khoan" class="${properties.kcButtonClass!} ${properties.kcButtonPrimaryClass!} ${properties.kcButtonBlockClass!}" href="${veApp}">${msg("vcChonTaiKhoanKhac")}</a>
            <#elseif !(skipLink??)>
                <p><a id="backToApplication" href="${veApp}">${msg("backToApplication")}</a></p>
            </#if>
            <p class="vc-thoi-diem" id="vc-thoi-diem">${msg("vcThoiDiem", .now?string("HH:mm dd/MM/yyyy"))}<#if traceId??> · ${msg("vcMaTheoDoi", traceId)}</#if></p>
            <p class="vc-ho-tro">${msg("vcHoTro")}</p>
        </div>
    </#if>
</@layout.registrationLayout>

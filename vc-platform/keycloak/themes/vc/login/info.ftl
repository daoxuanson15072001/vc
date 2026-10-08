<#-- Trang thông báo của VC ID (đã đăng xuất…): khi không có app để quay lại thì có đường về VC Home
     (thiết kế SSO mục 5.1.6). Dựa trên base/login/info.ftl của Keycloak 26. -->
<#import "template.ftl" as layout>
<@layout.registrationLayout displayMessage=false; section>
    <#if section = "header">
        <#if messageHeader??>
            ${kcSanitize(msg("${messageHeader}"))?no_esc}
        <#else>
            ${message.summary}
        </#if>
    <#elseif section = "form">
    <div id="kc-info-message">
        <#if message.summary == msg("successLogout")>
        <p class="instruction">${msg("vcDaDongPhien")}</p>
        <#else>
        <p class="instruction">${message.summary}<#if requiredActions??><#list requiredActions>: <b><#items as reqActionItem>${kcSanitize(msg("requiredAction.${reqActionItem}"))?no_esc}<#sep>, </#items></b></#list></#if></p>
        </#if>
        <#-- Keycloak đặt skipLink ở trang đã đăng xuất; VC ID vẫn cho đường về VC Home. -->
        <#if message.summary == msg("successLogout")>
            <p><a id="vc-ve-home" href="${properties.vcHomeUrl}">${msg("vcVeVcHome")}</a></p>
        <#elseif skipLink??>
        <#elseif pageRedirectUri?has_content>
            <p><a href="${pageRedirectUri}">${msg("backToApplication")}</a></p>
        <#elseif actionUri?has_content>
            <p><a href="${actionUri}">${msg("proceedWithAction")}</a></p>
        <#elseif !(client.baseUrl)?has_content>
            <p><a id="vc-ve-home" href="${properties.vcHomeUrl}">${msg("vcVeVcHome")}</a></p>
        <#else>
            <p><a href="${client.baseUrl}">${msg("backToApplication")}</a></p>
        </#if>
    </div>
    </#if>
</@layout.registrationLayout>

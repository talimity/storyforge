import type {
  ChatCompletionRequest,
  PreflightResult,
  TextInferenceCapabilities,
} from "@/types";

/**
 * Given a chat completion request and the provider's capabilities, determine
 * whether the request should use assistant prefill or not, and whether the
 * provider can satisfy that requirement.
 */
export function preflightPrefill(
  req: ChatCompletionRequest,
  caps: TextInferenceCapabilities
): PreflightResult {
  const hints = req.hints ?? {};
  const endsWithAssistant =
    req.messages.length > 0 &&
    req.messages[req.messages.length - 1].role === "assistant";

  // decide whether the *prompt semantics* expect prefill.
  const wantsPrefill =
    hints.assistantPrefill === "require" ||
    (hints.assistantPrefill !== "forbid" && endsWithAssistant);

  // forbidden > anything
  // in practice there's not much of a reason to not want prefill if the prompt
  // ends with assistant, but it's possible.
  if (hints.assistantPrefill === "forbid") {
    // some providers just always prefill even if you don't want it
    if (caps.assistantPrefill === "implicit" && endsWithAssistant) {
      return {
        ok: false,
        reason:
          "Provider implicitly prefills assistant continuations and cannot opt out.",
      };
    }
    return { ok: true, prefillMode: "no-prefill" };
  }

  // provider doesn't support prefill but prompt semantics require it
  if (wantsPrefill && caps.assistantPrefill === "unsupported") {
    return {
      ok: false,
      reason:
        "Template (or hints) require assistant prefill but provider does not support it.",
    };
  }

  // otherwise resolve the mode
  return { ok: true, prefillMode: wantsPrefill ? "prefill" : "no-prefill" };
}

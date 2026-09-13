export {
  DEFAULT_EMAIL_TIMEOUT_MS,
  EmailError,
  RESEND_SEND_URL,
  sendEmail,
  senderAddress,
  type EmailErrorCode,
  type EmailMessage,
  type SendOptions,
  type SendResult,
} from "./send.ts";
export {
  BRIEF_SPANS,
  EMAIL_COPY,
  briefEmail,
  howToUseEmail,
  refusalEmail,
  welcomeEmail,
  type BriefContent,
  type BriefFigure,
  type BriefSpan,
} from "./templates.ts";

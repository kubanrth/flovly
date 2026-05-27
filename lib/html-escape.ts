// Shared HTML escape dla user input wklejanego do HTML stringu
// (email templates, plain-text rendery). NIE używaj w JSX'ie —
// React auto-escapuje string children.

export { escape as escapeHtml } from "html-escaper";

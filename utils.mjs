export function messageManager(messages, category, message) {
  if (messages[category]) {
    messages[category].push(message);
  } else {
    messages[category] = [message];
  }
  return messages;
}

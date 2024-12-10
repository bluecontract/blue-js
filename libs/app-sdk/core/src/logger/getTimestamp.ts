export const getTimestamp = () => {
  const currentTime = new Date();
  const time24Hour = currentTime.toLocaleTimeString('en-US', { hour12: false });
  const milliseconds = String(currentTime.getMilliseconds()).padStart(3, '0');

  return `${time24Hour}:${milliseconds}`;
};

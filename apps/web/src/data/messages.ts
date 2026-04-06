// Demo fixture data — loosely typed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const messageGroups: any[] = [
  {
    id: "group-family",
    name: "Family",
    members: ["current-user", "matti-virtanen", "anna-korhonen"],
    isPrivate: true,
  },
  {
    id: "group-housing",
    name: "Housing Co-op Board",
    members: [
      "current-user",
      "liisa-makinen",
      "maria-lahtinen",
      "juha-nieminen",
    ],
    isPrivate: true,
  },
];

export const messages: any[] = [
  {
    id: "msg-1",
    senderId: "anna-korhonen",
    recipientId: "current-user",
    content:
      "Hi! Did you see the city centre development plan thread? I think we should coordinate our cycling club response.",
    createdAt: "2025-01-20T14:30:00Z",
    isEncrypted: true,
  },
  {
    id: "msg-2",
    senderId: "current-user",
    recipientId: "anna-korhonen",
    content:
      "Yes, I read through it. The cycling infrastructure section looks promising. Should we draft something together?",
    createdAt: "2025-01-20T15:00:00Z",
    isEncrypted: true,
  },
  {
    id: "msg-3",
    senderId: "anna-korhonen",
    recipientId: "current-user",
    content: "Great idea. Let's discuss at the group ride on Saturday?",
    createdAt: "2025-01-20T15:15:00Z",
    isEncrypted: true,
  },
  {
    id: "msg-4",
    senderId: "liisa-makinen",
    groupId: "group-housing",
    content:
      "Reminder: Our next board meeting is Thursday at 18:00. Main topic is the facade renovation budget.",
    createdAt: "2025-01-19T09:00:00Z",
    isEncrypted: true,
  },
  {
    id: "msg-5",
    senderId: "maria-lahtinen",
    groupId: "group-housing",
    content: "I'll be there. Should I bring the contractor quotes I received?",
    createdAt: "2025-01-19T10:30:00Z",
    isEncrypted: true,
  },
  {
    id: "msg-6",
    senderId: "matti-virtanen",
    groupId: "group-family",
    content:
      "Who's coming to Sunday dinner? Mom wants to know how much to cook.",
    createdAt: "2025-01-21T11:00:00Z",
    isEncrypted: true,
  },
];

export const getMessagesByConversation = (
  userId1: string,
  userId2: string,
): any[] => {
  return messages
    .filter(
      (msg) =>
        !msg.groupId &&
        ((msg.senderId === userId1 && msg.recipientId === userId2) ||
          (msg.senderId === userId2 && msg.recipientId === userId1)),
    )
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
};

export const getMessagesByGroup = (groupId: string): any[] => {
  return messages
    .filter((msg) => msg.groupId === groupId)
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
};

export const getConversations = (
  userId: string,
): { partnerId: string; lastMessage: any }[] => {
  const directMessages = messages.filter(
    (msg) =>
      !msg.groupId && (msg.senderId === userId || msg.recipientId === userId),
  );

  const partnerMap = new Map<string, any>();

  directMessages.forEach((msg) => {
    const partnerId = msg.senderId === userId ? msg.recipientId! : msg.senderId;
    const existing = partnerMap.get(partnerId);
    if (!existing || new Date(msg.createdAt) > new Date(existing.createdAt)) {
      partnerMap.set(partnerId, msg);
    }
  });

  return Array.from(partnerMap.entries())
    .map(([partnerId, lastMessage]) => ({ partnerId, lastMessage }))
    .sort(
      (a, b) =>
        new Date(b.lastMessage.createdAt).getTime() -
        new Date(a.lastMessage.createdAt).getTime(),
    );
};

export const getUserGroups = (userId: string): any[] => {
  return messageGroups.filter((group) => group.members.includes(userId));
};

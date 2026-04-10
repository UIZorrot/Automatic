export type Sender = "user" | "agent";

export type ChannelMessage = {
  id: number;
  channelId: string;
  sender: Sender;
  content: string;
  timestamp: string;
};

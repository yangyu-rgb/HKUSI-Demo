import type { CrowdLevel } from "../realtime/types";


export type CrowdsourceReport = {
  id: string;
  user_id: string;
  port: string;
  actual_wait_time: number;
  crowd_level: CrowdLevel;
  timestamp: string;
  time_label: string;
  comment: string;
};

export type CrowdsourceFeedResponse = {
  reports: CrowdsourceReport[];
  total: number;
};

export type ReportInput = {
  user_id: string;
  port: string;
  actual_wait_time: number;
  crowd_level: CrowdLevel;
  comment: string;
};

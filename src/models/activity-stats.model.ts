import { Contributor } from "./contributor.model";
import { SearchWeeklyActivity } from "./search-activity-stats.model";

export interface ActivityStats {
    total: number;
    weeks: SearchWeeklyActivity[];
    author: Contributor;
};

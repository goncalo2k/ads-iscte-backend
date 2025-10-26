import { SearchStats } from "./search-stats.model";

export interface Contributor extends SearchStats {
    id: number;
    node_id?: string;
    name: string;
    contributions: number;
}
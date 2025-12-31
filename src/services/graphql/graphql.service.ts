import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios from "axios";

@Injectable()
export class GraphQLService {
    githubUrl: string
    constructor(private cfg: ConfigService) { this.githubUrl = this.cfg.get('GITHUB_GRAPHQL_URL')!; }

    async getFromGraphQL<T>(
        accessToken: string,
        query: string,
        variables?: Record<string, any>,
    ) {
        const res = await axios.post<{ data?: T; errors?: any[] }>(
            this.githubUrl,
            { query, variables },
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    Accept: "application/vnd.github+json",
                },
            },
        );

        if (res.data.errors?.length) {
            throw new Error(`GraphQL failed: ${JSON.stringify(res.data.errors)}`);
        }

        return res.data.data as T;
    }
}


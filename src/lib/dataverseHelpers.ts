import { IGetAllOptions } from "@/generated/models/CommonModels"
import { IOperationResult } from "@microsoft/power-apps/data"

export const pageResults = async <T>(service: { getAll: (options?: IGetAllOptions) => Promise<IOperationResult<T[]>> }, options?: IGetAllOptions, maxPageCount?: number): Promise<T[]> => {
    const results: T[] = []
    
    let page = 0;
    let response: IOperationResult<T[]>
    do {
        options.skipToken = response?.skipToken || options.skipToken

        response = await service.getAll(options)
        page ++;
        results.push(...response.data)
    } while (response?.skipToken && (maxPageCount == null || page < maxPageCount))

    return results;
}
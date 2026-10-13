import type { SearchCategory } from "./types";
import { flowsCategory } from "./categories/flows";
import { actionsCategory } from "./categories/actions";

class SearchRegistryBuilder {
  private categories: SearchCategory<any, any>[] = [];
  register<T, P>(cat: SearchCategory<T, P>) {
    this.categories.push(cat as SearchCategory<any, any>);
    return this;
  }
  build() {
    return this.categories;
  }
}

export const searchRegistry: SearchCategory<any, any>[] = new SearchRegistryBuilder()
  .register(flowsCategory)
  .register(actionsCategory)
  .build();

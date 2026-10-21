import { createSceneMode } from './scene.js';
import { createPickMode } from './pick.js';
import { createOrderMode } from './order.js';

// 每种模式返回：{ el, counter(), isEmpty(), response(), lock(), reveal(result), destroy() }
export function createMode(level, handlers) {
  switch (level.content.kind) {
    case 'scene':
      return createSceneMode(level, handlers);
    case 'chat':
    case 'testimony':
      return createPickMode(level, handlers);
    case 'order':
      return createOrderMode(level, handlers);
    default:
      throw new Error(`未知的关卡内容类型：${level.content.kind}`);
  }
}

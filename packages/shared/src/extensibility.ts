// Inspector 扩展性共享类型
// 本文件无运行时副作用，纯类型导出

/** 按钮在选中框周围的相对位置。当前实现仅支持 'right'，其他值保留扩展位。 */
export type ActionButtonPosition = 'right';

/** 自定义按钮定义。onClick 接收 SelectEvent。 */
export interface ActionButtonDef {
  /** 唯一 id；同 id 重复 addToolBtn 视为覆盖。 */
  id: string;
  /** 显示图标：emoji 字符串 / 短文本 / iconify 串 (`i-prefix:name`)。 */
  icon: string;
  /** 鼠标悬停 tooltip。 */
  label: string;
  /** 位置策略；当前固定 'right'。 */
  position: ActionButtonPosition;
  /** 选中状态下点击触发。 */
  onClick: (event: SelectEvent) => void;
  /** 悬停背景色（可选）；缺省 #2563eb。 */
  hoverColor?: string;
  /** 基础背景色（可选）；缺省 #3b82f6，与 __vdi-copy-btn 一致。 */
  baseColor?: string;
}

/** 进入审查模式事件。 */
export interface InspectEvent {
  kind: 'inspect';
  /** 触发时间戳（毫秒）。 */
  at: number;
}

/** 选中 / 取消选中事件。target=null 表示取消选中。 */
export interface SelectEvent {
  kind: 'select';
  at: number;
  /** 当前选中元素；null 时为取消选中。 */
  target: HTMLElement | null;
  /** 若 target 非 null 且带 data-source-file 属性，解析后的位置；否则 null。 */
  source: { rootIndex: number; file: string; line: number; col: number } | null;
}

/** 事件回调签名。 */
export type EventCallback<E> = (event: E) => void;

/** 反注册函数。 */
export type Unregister = () => void;

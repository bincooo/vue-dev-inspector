## ADDED Requirements

### Requirement: 已添加属性显示视觉标记

抽屉渲染属性条目时 SHALL 检查每条属性的 `name` 是否已存在于 prop panel 的 `entries` 列表（按 `key` 匹配）。已存在的属性条目 SHALL 在行右侧显示 ✓ 标记，未存在的条目 SHALL NOT 显示标记。标记 SHALL 在以下时机同步更新：抽屉打开时、搜索过滤时、抽屉内点击添加属性后。prop panel 侧的 entries 变化（手动添加/删除/编辑 key）SHALL NOT 触发抽屉标记的实时更新；标记状态在下次抽屉 render（搜索或重新打开）时自然同步。

#### Scenario: 打开抽屉时标记已添加属性

- **WHEN** 用户已通过 prop panel 手动添加了 `type` 属性，随后打开属性抽屉
- **THEN** `type` 条目右侧显示 ✓ 标记，未添加的属性无标记

#### Scenario: 抽屉内点击添加后即时标记

- **WHEN** 用户在抽屉中点击 `size` 属性（此前未添加）
- **THEN** `size` 被追加到 entries，该行右侧立即显示 ✓ 标记

#### Scenario: 搜索过滤时保留标记

- **WHEN** 用户在搜索框输入关键词过滤属性列表
- **THEN** 过滤后显示的属性条目中，已存在于 entries 的条目仍显示 ✓ 标记

#### Scenario: 点击已标记的属性无操作

- **WHEN** 用户点击已显示 ✓ 标记的属性条目
- **THEN** 不重复添加，entries 列表不变，✓ 标记保持不变

#### Scenario: prop panel 侧变化不实时同步

- **WHEN** 用户在 prop panel 删除某属性或手动添加同名属性，抽屉保持打开
- **THEN** 抽屉中对应条目的 ✓ 标记状态不立即变化，下次搜索或重新打开抽屉时同步

#### Scenario: 关闭再打开抽屉重新同步

- **WHEN** 用户关闭抽屉后再次打开
- **THEN** ✓ 标记根据当前 entries 的实际状态重新计算

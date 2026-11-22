# 四类素材登记与真实引用契约 (asset-contract.md)

本文件定义全剧素材资产的登记结构、字段契约与真值标准。

---

## 一、全局唯一真值契约 (SSOT)

1. **唯一权威载体**：
   * 素材资产唯一维护在 `asset-registry` 产物中，排版参考 [asset-registry-template.md](templates/asset-registry-template.md)；
   * 登记簿为 JSON，记录当前正式对象、名称、类型、关系和真实路径；Visual DNA、声学标签与检查结论保存在对应资产目录的 design.md，登记簿引用它，不重复维护；
   * 资产目录由产物契约的 asset-design / asset-prompt 定位，assetType 对应 characters、costumes、scenes、props；实际设定板与 prompt.md 同目录，参考和声音文件按实际需要就近保存。归档按组织原则自由管理。
2. **真实媒体标准**：
   * 每条**正式视觉资产**必须绑定真实落盘的 16:9 制作设定板图片；只有实际有台词、旁白或明确声音身份复现需求的 **character** 条目才需绑定真实试听音频文件。服装、场景、道具和无发声需求的人物不需要音频；
   * 纯文本描述、计划路径或虚拟 URL 只可作为需求或待办记录。

---

## 二、四类资产共同登记字段规范

四类基础类型为 `character`（人物）、`costume`（服装）、`scene`（场景）、`prop`（道具）：

* `asset_id`：稳定唯一的全剧资产编号（如 `char_chen_mo`、`scene_inn_second_floor`）；
* `kind`：资产类型；
* `name`：资产名称 / 形态名称；
* `source_refs`：提取依据（关联的蓝图节点或剧本 `episode` 产物的具体场次）；
* `base_asset_id`：重大变身形态关联原人物、独立客房关联客栈等基础空间的资产 ID；独立新设计才建立正式变体，临时受伤或姿态不建正式资产；
* `design_path`：对应 design.md，内含遵循 [asset-extraction-rules.md](asset-extraction-rules.md) 的 Visual DNA 与设计检查；
* `image_board_path`、`prompt_path`：实际 16:9 设定板及其完整 Prompt；全部路径以 artifacts 为根的相对路径，不使用 archive 内的文件作为当前成果；
* `voice_spec`（仅需要稳定发声身份的人物）：在 design.md 记录 `voice_id` 配置、声学先验标签与收听结果，索引可登记真实试听路径；无发声需求省略，不阻断视觉资产采用。

根对象使用 `assets` 数组；每项为当前正式对象，字段按上述契约及模板，未生成的需求留在设计与待办，不以候选素材充数。

---

## 三、登记时机与证据

在每项正式设计实际生成且完成本轮媒体检查后，按本次已核实范围更新组织现有 `asset-registry`。如果缺少真实文件、试听或仍需确认的内容，只记实际状态与待办，不能伪造“已完成”。基础建库、正文补缺及导演定向补图的**具体时序**统一见[素材设计](asset-design.md)，本契约不设置第二套生产流程。

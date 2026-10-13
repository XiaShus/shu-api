package model

type EcomTemplate struct {
	Id          int    `json:"id" gorm:"primaryKey"`
	Slug        string `json:"slug" gorm:"size:64;uniqueIndex"`
	Title       string `json:"title" gorm:"size:200"`
	Category    string `json:"category" gorm:"size:32;index"`
	Badge       string `json:"badge" gorm:"size:32"`
	Recommended bool   `json:"recommended"`
	Summary     string `json:"summary" gorm:"size:500"`
	Billing     string `json:"billing" gorm:"size:32"`
	Sort        int    `json:"sort"`
}

func (EcomTemplate) TableName() string {
	return "ecom_templates"
}

func ListEcomTemplates(category string) ([]EcomTemplate, error) {
	query := DB.Model(&EcomTemplate{}).Order("sort asc, id asc")
	switch category {
	case "", "all":
	case "recommended":
		query = query.Where("recommended = ?", true)
	default:
		query = query.Where("category = ?", category)
	}
	var rows []EcomTemplate
	err := query.Find(&rows).Error
	return rows, err
}

func EnsureEcomTemplates() error {
	var count int64
	if err := DB.Model(&EcomTemplate{}).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	return DB.Create(defaultEcomTemplates()).Error
}

func defaultEcomTemplates() []EcomTemplate {
	type seed struct {
		slug, title, category, badge, summary string
		recommended                           bool
	}
	items := []seed{
		{"cutout", "一键抠图", "cutout", "推荐", "上传商品图，自动抠出主体，输出透明底 PNG", true},
		{"bundle", "电商套图（普通版）", "hero", "推荐", "5 个核心子项：首屏主视觉 / 核心卖点 / 使用场景 / 多角度 / 场景氛围", true},
		{"try-on", "模特换装", "model", "推荐", "把商品（衣服）穿到指定模特身上", true},
		{"garment-on", "服装上身", "model", "推荐", "上传平铺服装 + 模特图，一键试穿", true},
		{"variants", "裂变套图", "hero", "推荐", "上传 1 张主图，自动裂变为多元风格的多张套图", true},
		{"bundle-max", "电商套图 MAX 版", "hero", "推荐", "16 个营销子项全配齐：从主视觉/卖点/场景到规格/对比/工艺/售后", true},
		{"sharpen", "变清晰", "cutout", "实用", "把模糊低清的商品图放大并锐化，适合电商详情页", false},
		{"redraw", "高清重绘", "cutout", "", "保留构图的高清重绘，用于优化模糊老图", false},
		{"line-art", "提取线稿", "scene", "", "把商品图转成黑白线稿，适合用作设计稿底图", false},
		{"watermark", "去除水印", "cutout", "实用", "智能擦除图片上的水印、logo、文字", false},
		{"wearables", "万物穿戴", "model", "NEW", "鞋包帽子等饰品类商品一键穿戴上身", false},
		{"outfit", "搭配融图", "model", "套图", "融合多件商品 + 模特/场景，生成整套搭配套图", false},
		{"swap-model", "换模特背景", "model", "", "同一商品替换不同模特和场景，快速产出多套主图", false},
		{"text-scene", "创意生图", "scene", "", "用文字描述，随心生成想要的模特/场景图", false},
		{"flat-3d", "平铺转3D", "scene", "", "把平铺服装/商品图转成立体 3D 立体悬浮展示", false},
		{"swap-bg", "商品换背景", "cutout", "热门", "商品图换背景，生成不同氛围的场景图", false},
		{"detail", "服装细节图", "scene", "", "服装图自动生成细节放大特写，展示工艺与材质", false},
		{"extract", "商品提取", "cutout", "实用", "从模特图/场景图中提取商品平铺图", false},
		{"seed", "服装种草图", "model", "", "保持穿搭不变，自由切换模特/场景/姿势，生成种草图", false},
		{"retouch", "商品精修", "cutout", "实用", "一键提升商品图质感，去瑕疵 / 提锐度 / 加质感", false},
		{"selling", "商品卖点图", "hero", "热门", "把商品图转成可视化的卖点海报，适合电商主图位", false},
	}
	rows := make([]EcomTemplate, 0, len(items))
	for i, item := range items {
		rows = append(rows, EcomTemplate{
			Slug:        item.slug,
			Title:       item.title,
			Category:    item.category,
			Badge:       item.badge,
			Recommended: item.recommended,
			Summary:     item.summary,
			Billing:     "按图计费",
			Sort:        i + 1,
		})
	}
	return rows
}

func EcomTemplateCategoryCounts() (map[string]int64, error) {
	type row struct {
		Category string
		Count    int64
	}
	var rows []row
	err := DB.Model(&EcomTemplate{}).Select("category, count(*) as count").Group("category").Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	counts := map[string]int64{}
	var total int64
	for _, item := range rows {
		counts[item.Category] = item.Count
		total += item.Count
	}
	counts["all"] = total
	var recommended int64
	if err = DB.Model(&EcomTemplate{}).Where("recommended = ?", true).Count(&recommended).Error; err != nil {
		return nil, err
	}
	counts["recommended"] = recommended
	return counts, nil
}

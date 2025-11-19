

Hero区视觉标注文件

覆盖范围： 从顶部导航栏开始，到岗位列表上方的整个区域。

1. 整体布局与背景

•   布局模型： 该区域为典型的 两列布局（Two-column layout）。

    ◦   左列： 内容区（文本、搜索、按钮）。

    ◦   右列： 装饰性插画区。

•   背景：

    ◦   主背景色： 整个区域的背景是一个柔和的水平方向线性渐变。

        ▪   渐变角度：约 90deg（从左到右）。

        ▪   色值：从左边的米白色 #F9F5F0 渐变到右边的浅橙色 #FBE9D1。

    ◦   背景图片： 使用素材图文件home_bg.svg。

        ▪   属性： background-image: url('path/to/illustration.png')。

        ▪   定位： background-position: right bottom;（右下角对齐）。

        ▪   大小： background-size: contain;（保持图片原始比例，确保人物和元素完整显示）。

        ▪   重复： background-repeat: no-repeat;。

2. 顶部导航栏

•   高度： 80px。

•   内边距： 左右边距各 5%（或一个固定值如 60px），相对于容器左右对齐。

•   品牌标识（Haigoo Remote Club）：

    ◦   字体： 无衬线字体，字重 700（Bold）。

    ◦   字号： 24px。

    ◦   颜色： 深灰色 #1D1D1F。

•   导航菜单位于品牌右侧，具体样式在本次标注范围外，可后续补充。

3. 主内容区（左列）

该区域内容应垂直居中于整个Hero区高度。

•   主标题（WORK YOUR BRAIN, LEAVE YOUR BODY TO BE HAPPY）：

    ◦   字体： 无衬线字体，字重 700（Bold）。

    ◦   字号： 56px（桌面端）。行高： 1.1（或约62px）。

    ◦   颜色： 深灰色 #1D1D1F。

    ◦   间距： 标题底部外间距 40px。



4. 装饰插画区（右列）

•   背景图片已覆盖。图片内容（两位人物、云朵、吊床、科技图形）的位置和大小由背景属性（right bottom 和 contain）控制，无需额外定位。

5. 开发要点与变量

• 背景类：`landing-bg-page` 应用于页面外层以固定背景。
• 颜色变量（统一使用）：
  - `--brand-blue: #3182CE`
  - `--brand-navy: #1A365D`
  - `--brand-teal: #0EA5A3`
  - `--brand-orange: #F59F0B`
  - `--brand-sand: #F5F5DC`
  - `--brand-border: #E2E8F0`

• 响应式：桌面两列、移动单列；插画尺寸与位置在断点下收敛。

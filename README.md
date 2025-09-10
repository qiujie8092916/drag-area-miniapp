# Drag Area Mini App

WeChat 小程序拖拽工作区组件

## 开发环境设置

### LESS 编译设置

本项目使用 LESS 来编写样式文件，需要编译为 WXSS 格式。

#### 安装依赖

```bash
npm install
```

#### 编译 LESS 文件

```bash
# 单次编译
npm run build:less

# 监听模式（开发时推荐）
npm run watch:less

# 或者使用开发模式
npm run dev
```

#### 文件结构

- `components/drag-workspace/drag-workspace.less` - LESS 源文件
- `components/drag-workspace/drag-workspace.wxss` - 编译后的样式文件（由 LESS 自动生成）

#### 开发流程

1. 修改 `drag-workspace.less` 文件
2. 运行 `npm run watch:less` 开启监听模式
3. LESS 文件会自动编译为 WXSS 文件
4. 微信开发者工具会自动检测 WXSS 文件变化并更新

#### LESS 特性使用

本项目的 LESS 文件使用了以下特性：

- **变量**: 统一管理颜色、尺寸等设计规范
- **嵌套**: 更清晰的样式层次结构
- **Mixins**: 复用常见的样式模式
- **函数**: 动态计算样式值

#### 注意事项

- 不要直接修改 `.wxss` 文件，所有样式修改都应该在 `.less` 文件中进行
- 提交代码时需要包含编译后的 `.wxss` 文件
- 确保 LESS 编译无错误后再进行测试

## 组件使用

### 基本用法

```xml
<drag-workspace 
  currentSide="{{currentSide}}"
  mainPrimitive="{{mainPrimitive}}"
  patchesPrimitive="{{patchesPrimitive}}"
  movableAreaPrimitive="{{movableAreaPrimitive}}"
  nonMovableAreasPrimitive="{{nonMovableAreasPrimitive}}"
  showAreaGuidesPrimitive="{{showAreaGuidesPrimitive}}"
  bind:patchDelete="onPatchDelete"
  bind:snapshotGenerated="onSnapshotGenerated"
/>
```

更多使用说明请参考组件源码和示例页面。

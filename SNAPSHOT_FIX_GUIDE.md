# 快照生成修复说明

## 问题描述
之前的快照生成存在问题：正反面快照可能包含了错误的底件图片或贴件数据。

## 修复内容

### 1. 增强 `createCanvasSnapshot` 方法
- 添加了更明确的变量命名，确保只使用指定面的数据
- 添加了详细的控制台日志，便于调试和确认生成过程
- 明确分离正反面的底件图片源：`const mainImageSrc = this.properties.mainPrimitive[sideType].src`

### 2. 增强 `drawPatchesOnCanvasRelativeToImage` 方法
- 新增 `sideType` 参数，确保绘制过程中知道当前处理的是哪一面
- 添加了详细的控制台日志，显示每个贴件的绘制过程
- 改进了错误处理，当贴件图片加载失败时会有明确的日志提示

### 3. 数据流确认
现在的快照生成流程如下：

**正面快照 (sideType = "front")**：
1. 获取 `this.data.frontSide` 作为 `sideData`
2. 获取 `this.properties.mainPrimitive.front.src` 作为底件图片
3. 绘制正面底件图片
4. 绘制 `frontSide.patches` 中的所有贴件

**反面快照 (sideType = "back")**：
1. 获取 `this.data.backSide` 作为 `sideData`
2. 获取 `this.properties.mainPrimitive.back.src` 作为底件图片
3. 绘制反面底件图片
4. 绘制 `backSide.patches` 中的所有贴件

### 4. 调试信息
修复后的代码会在控制台输出详细的日志信息：

```
生成front面快照，贴件数量: 3
绘制front面贴件，数量: 3
front面贴件绘制完成: 1/3
front面贴件绘制完成: 2/3
front面贴件绘制完成: 3/3
front面快照生成成功: [临时文件路径]
```

这样可以清楚地确认每一面的快照都只包含对应面的数据。

## 使用验证

1. **测试方法一**: 检查控制台日志
   - 调用快照生成功能
   - 观察控制台输出，确认正反面分别处理了正确数量的贴件
   - 确认底件图片路径是否正确

2. **测试方法二**: 数据对比
   - 在 `generateSnapshot` 调用前，手动打印正反面的贴件数据
   - 对比快照生成过程中的日志，确认数据一致性

3. **测试方法三**: 视觉确认
   - 生成的正面快照应该只包含正面底件和正面贴件
   - 生成的反面快照应该只包含反面底件和反面贴件

## 注意事项

1. 确保 `properties.mainPrimitive.front.src` 和 `properties.mainPrimitive.back.src` 分别指向正确的图片
2. 确保 `properties.patchesPrimitive.front` 和 `properties.patchesPrimitive.back` 分别包含正确的贴件配置
3. 如果某一面没有贴件，快照仍然会正常生成，只包含底件图片

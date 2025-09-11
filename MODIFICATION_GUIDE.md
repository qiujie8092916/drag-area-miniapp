# drag-workspace 组件修改说明

## 修改内容

### 1. 新增对外暴露的方法

#### `generateWorkspaceSnapshot()`
- **功能**: 供外部调用的生成快照方法
- **返回**: Promise 对象
  - 成功时返回: `{ frontImagePath: string, backImagePath: string }`
  - 失败时返回: 错误信息
- **使用方式**:
  ```javascript
  const dragWorkspace = this.selectComponent('#drag-workspace');
  dragWorkspace.generateWorkspaceSnapshot()
    .then(result => {
      console.log('快照生成成功:', result);
    })
    .catch(error => {
      console.error('快照生成失败:', error);
    });
  ```

#### `canGenerateSnapshot()`
- **功能**: 检查当前是否可以生成快照
- **返回**: Boolean 值
  - `true`: 正反面贴件都有效且未在生成中
  - `false`: 存在无效贴件或正在生成中
- **使用方式**:
  ```javascript
  const dragWorkspace = this.selectComponent('#drag-workspace');
  const canGenerate = dragWorkspace.canGenerateSnapshot();
  ```

### 2. 新增事件通知

#### `validityChange` 事件
- **触发时机**: 贴件有效性状态发生变化时
- **事件参数**:
  ```javascript
  {
    frontValid: boolean,     // 正面所有贴件是否有效
    backValid: boolean,      // 反面所有贴件是否有效
    canGenerateSnapshot: boolean  // 是否可以生成快照
  }
  ```
- **使用方式**:
  ```xml
  <drag-workspace bind:validityChange="onValidityChange"></drag-workspace>
  ```
  ```javascript
  onValidityChange(e) {
    const { frontValid, backValid, canGenerateSnapshot } = e.detail;
    this.setData({ canGenerateSnapshot });
  }
  ```

### 3. 修改的内部逻辑

#### 生成快照方法改进
- 原方法 `generateSnapshot()` 改为内部方法
- 新增返回 Promise，便于外部处理成功/失败状态
- 移除了内部的保存提示逻辑，由外部控制

#### 状态通知机制
- 在所有可能影响贴件有效性的地方添加了 `notifyValidityChange()` 调用
- 包括：图片加载完成、贴件位置变化、旋转操作、条件检查等

## 使用示例

### 完整的页面集成示例

```javascript
// 页面 JS 文件
Page({
  data: {
    canGenerateSnapshot: false,
    frontValid: false,
    backValid: false,
    // 组件配置数据...
  },

  // 监听有效性变化
  onValidityChange(e) {
    const { frontValid, backValid, canGenerateSnapshot } = e.detail;
    this.setData({
      frontValid,
      backValid,
      canGenerateSnapshot
    });
  },

  // 生成快照按钮点击
  onGenerateSnapshotTap() {
    const dragWorkspace = this.selectComponent('#drag-workspace');
    
    if (!dragWorkspace.canGenerateSnapshot()) {
      wx.showToast({
        title: '当前状态无法生成快照',
        icon: 'error'
      });
      return;
    }

    dragWorkspace.generateWorkspaceSnapshot()
      .then(result => {
        // 处理成功结果
        this.handleSnapshotSuccess(result);
      })
      .catch(error => {
        // 处理失败
        wx.showToast({
          title: '生成失败',
          icon: 'error'
        });
      });
  },

  // 处理快照生成成功
  handleSnapshotSuccess(result) {
    wx.showModal({
      title: '快照生成成功',
      content: '是否保存到相册？',
      success: (res) => {
        if (res.confirm) {
          this.saveToAlbum(result);
        }
      }
    });
  }
});
```

```xml
<!-- 页面 WXML 文件 -->
<view class="container">
  <!-- 状态显示 -->
  <view class="status">
    <text>可生成快照: {{canGenerateSnapshot ? '是' : '否'}}</text>
  </view>

  <!-- 拖拽组件 -->
  <drag-workspace 
    id="drag-workspace"
    bind:validityChange="onValidityChange"
    bind:snapshotGenerated="onSnapshotGenerated"
    <!-- 其他属性... -->>
  </drag-workspace>

  <!-- 操作按钮 -->
  <button 
    disabled="{{!canGenerateSnapshot}}"
    bindtap="onGenerateSnapshotTap">
    生成快照
  </button>
</view>
```

## 向后兼容性

- 所有原有的属性和事件都保持不变
- 原有的内部生成快照逻辑仍然存在，只是不再对外暴露
- 添加的新方法和事件不会影响现有使用方式

## 注意事项

1. **权限检查**: 调用生成快照前建议先检查 `canGenerateSnapshot()` 状态
2. **异步处理**: `generateWorkspaceSnapshot()` 是异步方法，需要正确处理 Promise
3. **状态同步**: 监听 `validityChange` 事件可以实时获取组件状态变化
4. **错误处理**: 建议为所有异步调用添加错误处理逻辑

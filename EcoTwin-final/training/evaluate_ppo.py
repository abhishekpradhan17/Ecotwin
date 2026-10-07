"""Evaluate a PPO checkpoint against the EcoTwin Gymnasium environment."""
import os, sys, numpy as np, torch, ray
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from ray.rllib.core.rl_module.rl_module import RLModule
from backend.traffic_env import TrafficEnv

checkpoint=os.environ.get("ECOTWIN_PPO_CHECKPOINT", os.path.join(os.path.dirname(__file__),"checkpoints","learner_group","learner","rl_module","default_policy"))
ray.init(ignore_reinit_error=True, include_dashboard=False)
module=RLModule.from_checkpoint(checkpoint); env=TrafficEnv(); obs,_=env.reset(); total=0.0
for step in range(100):
    out=module.forward_inference({"obs":torch.from_numpy(np.asarray(obs,dtype=np.float32)).unsqueeze(0)})
    action=int(out["actions"][0].item()) if "actions" in out else int(torch.argmax(out["action_dist_inputs"],dim=-1).item())
    obs,reward,terminated,truncated,info=env.step(action); total+=reward
    if terminated or truncated: break
print({"steps":step+1,"total_reward":total,"final_info":info})
env.close(); ray.shutdown()
